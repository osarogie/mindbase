package api

import (
	"encoding/json"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/osarogie/mindbase/internal/attachments"
	"github.com/osarogie/mindbase/internal/connectors"
	"github.com/osarogie/mindbase/internal/database"
	"github.com/osarogie/mindbase/internal/notes"
	"github.com/osarogie/mindbase/internal/ui"
	uistatic "github.com/osarogie/mindbase/internal/ui/static"
	"github.com/osarogie/mindbase/internal/vault"
	"github.com/osarogie/mindbase/internal/vaultparse"
	"github.com/osarogie/mindbase/internal/watcher"
	"github.com/osarogie/mindbase/internal/webui"
)

type UIMode string

const (
	UIAuto  UIMode = "auto"
	UIReact UIMode = "react"
	UITempl UIMode = "templ"
)

type Server struct {
	vault       *vault.Vault
	notes       *notes.Service
	databases   *database.Service
	attachments *attachments.Service
	watcher     *watcher.Watcher
	ui          *ui.Handlers
	connectors  *connectors.Service
	webDir      string
	webFS       fs.FS
	useReactUI  bool
	uiMode      UIMode
	runtime     RuntimeInfo
}

// RuntimeInfo describes how the HTTP server is exposed.
type RuntimeInfo struct {
	TLS   bool
	HTTP3 bool
}

func (s *Server) SetRuntimeInfo(info RuntimeInfo) {
	s.runtime = info
}

func (s *Server) UsesReactUI() bool {
	return s.useReactUI
}

func New(v *vault.Vault, mode UIMode, webDir string) (*Server, error) {
	return NewWithFS(v, mode, webDir, nil)
}

func NewWithFS(v *vault.Vault, mode UIMode, webDir string, webFS fs.FS) (*Server, error) {
	w, err := watcher.New(v)
	if err != nil {
		return nil, err
	}
	uiHandlers, err := ui.NewHandlers(v)
	if err != nil {
		return nil, err
	}
	connSvc, err := connectors.NewService(v)
	if err != nil {
		return nil, err
	}
	useReact, resolvedFS, resolvedDir := resolveReactUI(mode, webDir, webFS)
	return &Server{
		vault:       v,
		notes:       notes.NewService(v),
		databases:   database.NewService(v),
		attachments: attachments.NewService(v),
		watcher:     w,
		ui:          uiHandlers,
		connectors:  connSvc,
		webDir:      resolvedDir,
		webFS:       resolvedFS,
		useReactUI:  useReact,
		uiMode:      mode,
	}, nil
}

func resolveReactUI(mode UIMode, webDir string, webFS fs.FS) (useReact bool, fsOut fs.FS, dir string) {
	switch mode {
	case UITempl:
		return false, nil, ""
	case UIReact:
		if webFS != nil {
			return true, webFS, ""
		}
		if webDir != "" {
			return true, nil, webDir
		}
		if embedded, ok := webui.FS(); ok {
			return true, embedded, ""
		}
		return false, nil, ""
	default: // auto — prefer React when a build is available
		if webDir != "" {
			return true, nil, webDir
		}
		if webFS != nil {
			return true, webFS, ""
		}
		if embedded, ok := webui.FS(); ok {
			return true, embedded, ""
		}
		return false, nil, ""
	}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
	}))

	r.Get("/api/health", s.handleHealth)
	r.Post("/api/debug/client-log", s.handleClientDebugLog)
	r.Get("/api/vault", s.handleVaultInfo)
	r.Get("/api/search", s.handleAPISearch)
	r.Get("/api/history", s.handleHistoryLog)
	r.Get("/api/history/{rev}", s.handleHistorySnapshot)

	r.Route("/api/notes", func(r chi.Router) {
		r.Get("/", s.handleListNotes)
		r.Get("/*", s.handleGetNote)
		r.Put("/*", s.handleSaveNote)
		r.Delete("/*", s.handleDeleteNote)
	})

	// Reverse references: which notes link to the given note via [[wiki-links]].
	r.Get("/api/backlinks/*", s.handleBacklinks)

	r.Route("/api/databases", func(r chi.Router) {
		r.Get("/", s.handleListDatabases)
		r.Get("/*", s.handleDatabaseRoute)
		r.Put("/*", s.handleDatabaseSaveRoute)
		r.Delete("/*", s.handleDatabaseDeleteRoute)
	})

	r.Route("/api/attachments", func(r chi.Router) {
		r.Get("/*", s.handleListAttachments)
		r.Post("/*", s.handleUploadAttachment)
		r.Delete("/*", s.handleDeleteAttachmentRoute)
	})

	r.Get("/api/files/*", s.handleServeAttachment)
	r.Get("/api/ws", s.watcher.HandleWS)

	r.Route("/api/sync", func(r chi.Router) {
		s.ui.MountSyncAPI(r)
	})

	r.Route("/api/connectors", func(r chi.Router) {
		connectors.NewAPI(s.connectors).Mount(r)
	})

	r.Handle("/static/*", uistatic.Handler())

	if s.useReactUI {
		r.Get("/*", s.serveSPA)
	} else {
		s.ui.Mount(r)
	}

	return r
}

func (s *Server) handleAPISearch(w http.ResponseWriter, r *http.Request) {
	results, err := s.ui.SearchQuery(r.URL.Query().Get("q"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, results)
}

func (s *Server) StartConnectors() {
	if s.connectors != nil {
		s.connectors.StartBackgroundSync()
	}
}

func (s *Server) Close() {
	if s.connectors != nil {
		s.connectors.StopBackgroundSync()
	}
	s.watcher.Close()
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]any{
		"status": "ok",
		"proto":  r.Proto,
		"tls":    s.runtime.TLS,
		"http3":  s.runtime.HTTP3,
	})
}

func (s *Server) handleVaultInfo(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{
		"root": s.vault.Root,
		"name": filepath.Base(s.vault.Root),
	})
}

func (s *Server) handleListNotes(w http.ResponseWriter, r *http.Request) {
	list, err := s.notes.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, list)
}

func (s *Server) handleGetNote(w http.ResponseWriter, r *http.Request) {
	path := chi.URLParam(r, "*")
	note, err := s.notes.Get(path)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, note)
}

func (s *Server) handleBacklinks(w http.ResponseWriter, r *http.Request) {
	path := chi.URLParam(r, "*")
	links, err := vaultparse.FindBacklinks(s.vault, path)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, links)
}

func (s *Server) handleSaveNote(w http.ResponseWriter, r *http.Request) {
	path := chi.URLParam(r, "*")
	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	note, err := s.notes.Save(path, body.Content)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, note)
}

func (s *Server) handleDeleteNote(w http.ResponseWriter, r *http.Request) {
	path := chi.URLParam(r, "*")
	if err := s.notes.Delete(path); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleListDatabases(w http.ResponseWriter, r *http.Request) {
	list, err := s.databases.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, list)
}

func databasePathFromRequest(r *http.Request) (name string, isQuery bool) {
	raw := strings.TrimPrefix(chi.URLParam(r, "*"), "/")
	if strings.HasSuffix(raw, "/query") {
		return strings.TrimSuffix(raw, "/query"), true
	}
	return raw, false
}

func (s *Server) handleDatabaseRoute(w http.ResponseWriter, r *http.Request) {
	name, isQuery := databasePathFromRequest(r)
	if name == "" {
		writeError(w, http.StatusBadRequest, errMissingFilename)
		return
	}
	if isQuery {
		s.handleQueryDatabase(w, r, name)
		return
	}
	s.handleGetDatabase(w, r, name)
}

func (s *Server) handleDatabaseSaveRoute(w http.ResponseWriter, r *http.Request) {
	name, isQuery := databasePathFromRequest(r)
	if isQuery || name == "" {
		writeError(w, http.StatusBadRequest, errMissingFilename)
		return
	}
	s.handleSaveDatabase(w, r, name)
}

func (s *Server) handleDatabaseDeleteRoute(w http.ResponseWriter, r *http.Request) {
	name, isQuery := databasePathFromRequest(r)
	if isQuery || name == "" {
		writeError(w, http.StatusBadRequest, errMissingFilename)
		return
	}
	s.handleDeleteDatabase(w, r, name)
}

func (s *Server) handleGetDatabase(w http.ResponseWriter, r *http.Request, name string) {
	table, err := s.databases.Get(name)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, table)
}

func (s *Server) handleSaveDatabase(w http.ResponseWriter, r *http.Request, name string) {
	var body struct {
		Content string     `json:"content"`
		Headers []string   `json:"headers"`
		Rows    [][]string `json:"rows"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var table *database.Table
	var err error
	if body.Content != "" {
		table, err = database.SaveMarkdown(s.databases, name, body.Content)
	} else {
		table, err = s.databases.Save(name, body.Headers, body.Rows)
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, table)
}

func (s *Server) handleDeleteDatabase(w http.ResponseWriter, r *http.Request, name string) {
	if err := s.databases.Delete(name); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleQueryDatabase(w http.ResponseWriter, r *http.Request, name string) {
	filter := r.URL.Query().Get("filter")
	result, err := s.databases.Query(name, filter)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, result)
}

func (s *Server) handleListAttachments(w http.ResponseWriter, r *http.Request) {
	notePath := chi.URLParam(r, "*")
	list, err := s.attachments.List(notePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, list)
}

func (s *Server) handleUploadAttachment(w http.ResponseWriter, r *http.Request) {
	notePath := chi.URLParam(r, "*")
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	defer file.Close()

	entry, err := s.attachments.Save(notePath, header.Filename, file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, entry)
}

func (s *Server) handleDeleteAttachmentRoute(w http.ResponseWriter, r *http.Request) {
	notePath, filename := splitAttachmentPath(chi.URLParam(r, "*"))
	if filename == "" {
		writeError(w, http.StatusBadRequest, errMissingFilename)
		return
	}
	if err := s.attachments.Delete(notePath, filename); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleServeAttachment(w http.ResponseWriter, r *http.Request) {
	notePath, filename := splitAttachmentPath(chi.URLParam(r, "*"))
	s.serveAttachmentFile(w, r, notePath, filename)
}

func (s *Server) serveAttachmentFile(w http.ResponseWriter, r *http.Request, notePath, filename string) {
	if filename == "" {
		writeError(w, http.StatusBadRequest, errMissingFilename)
		return
	}
	full, err := s.attachments.Open(notePath, filename)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	http.ServeFile(w, r, full)
}

func (s *Server) serveSPA(w http.ResponseWriter, r *http.Request) {
	if s.webFS != nil {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}
		data, err := fs.ReadFile(s.webFS, path)
		if err != nil {
			data, err = fs.ReadFile(s.webFS, "index.html")
			if err != nil {
				http.NotFound(w, r)
				return
			}
		}
		if strings.HasSuffix(path, ".html") {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
		} else if strings.HasSuffix(path, ".js") {
			w.Header().Set("Content-Type", "application/javascript")
		} else if strings.HasSuffix(path, ".css") {
			w.Header().Set("Content-Type", "text/css")
		}
		_, _ = w.Write(data)
		return
	}

	path := filepath.Join(s.webDir, r.URL.Path)
	if info, err := os.Stat(path); err == nil && !info.IsDir() {
		http.ServeFile(w, r, path)
		return
	}
	http.ServeFile(w, r, filepath.Join(s.webDir, "index.html"))
}

func splitAttachmentPath(raw string) (notePath, filename string) {
	raw = strings.TrimPrefix(raw, "/")
	if raw == "" {
		return "", ""
	}
	parts := strings.Split(raw, "/")
	if len(parts) == 1 {
		return parts[0], ""
	}
	filename = parts[len(parts)-1]
	notePath = strings.Join(parts[:len(parts)-1], "/")
	return notePath, filename
}

var errMissingFilename = &apiError{msg: "filename required"}

type apiError struct {
	msg string
}

func (e *apiError) Error() string { return e.msg }

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, err error) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
}

// Unused import guard for io in case of future streaming
var _ = io.Discard
