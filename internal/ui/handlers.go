package ui

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/osarogie/mindbase/internal/ai"
	"github.com/osarogie/mindbase/internal/connectors"
	"github.com/osarogie/mindbase/internal/attachments"
	"github.com/osarogie/mindbase/internal/database"
	"github.com/osarogie/mindbase/internal/excalidraw"
	"github.com/osarogie/mindbase/internal/journal"
	"github.com/osarogie/mindbase/internal/markdown"
	"github.com/osarogie/mindbase/internal/notes"
	"github.com/osarogie/mindbase/internal/search"
	"github.com/osarogie/mindbase/internal/sync"
	"github.com/osarogie/mindbase/internal/ui/templates"
	"github.com/osarogie/mindbase/internal/vault"
	"github.com/osarogie/mindbase/internal/vaultparse"
)

type Handlers struct {
	vault       *vault.Vault
	notes       *notes.Service
	databases   *database.Service
	attachments *attachments.Service
	search      *search.Service
	sync        *sync.Service
	excalidraw  *excalidraw.Service
	connectors  *connectors.Service
}

func NewHandlers(v *vault.Vault) (*Handlers, error) {
	conn, err := connectors.NewService(v)
	if err != nil {
		return nil, err
	}
	return &Handlers{
		vault:       v,
		notes:       notes.NewService(v),
		databases:   database.NewService(v),
		attachments: attachments.NewService(v),
		search:      search.NewService(v),
		sync:        sync.NewService(v),
		excalidraw:  excalidraw.NewService(v),
		connectors:  conn,
	}, nil
}

func (h *Handlers) Mount(r chi.Router) {
	r.Get("/", h.handleHome)
	r.Get("/notes/*", h.handleNote)
	r.Put("/notes/*", h.handleSaveNote)
	r.Get("/databases", h.handleDatabasesHome)
	r.Get("/databases/*", h.handleDatabase)
	r.Put("/databases/*", h.handleSaveDatabase)
	r.Get("/search", h.handleSearch)
	r.Post("/attachments/*", h.handleUploadAttachment)
	r.Get("/preview/*", h.handlePreview)
	r.Post("/preview", h.handlePreviewBody)
	r.Get("/excalidraw/{note}/*", h.handleExcalidraw)
	r.Get("/sync/status", h.handleSyncStatus)
	r.Get("/journal/today", h.handleJournalToday)
	r.Get("/journal/week", h.handleJournalWeek)
	r.Get("/journal/{date}", h.handleJournalDate)
	r.Get("/tasks", h.handleTasks)
	r.Get("/tags/{tag}", h.handleTag)
	r.Get("/connectors", h.handleConnectors)
	r.Post("/reveal", h.handleReveal)
}

func (h *Handlers) SearchQuery(q string) ([]search.Result, error) {
	return h.search.Query(q)
}

func (h *Handlers) pageData(view string) templates.PageData {
	noteList, _ := h.notes.List()
	dbList, _ := h.databases.List()

	var notes []templates.NoteItem
	for _, n := range noteList {
		notes = append(notes, templates.NoteItem{
			Path: n.Path, Title: n.Title, Modified: n.Modified, HasAttach: n.HasAttach,
		})
	}
	var dbs []templates.DatabaseItem
	for _, d := range dbList {
		dbs = append(dbs, templates.DatabaseItem{Name: d.Name, Rows: d.Rows, Modified: d.Modified})
	}
	items := buildVaultItems(notes, dbs)
	data := templates.PageData{
		VaultName:      filepath.Base(h.vault.Root),
		View:           view,
		Items:          items,
		FolderSections: buildFolderSections(items),
		Notes:          notes,
		Databases:      dbs,
	}
	return h.enrichPageData(data)
}

func (h *Handlers) noteIndex() map[string]string {
	list, _ := h.notes.List()
	paths := make([]string, len(list))
	for i, n := range list {
		paths[i] = n.Path
	}
	return markdown.BuildNoteIndex(paths)
}

func (h *Handlers) renderOpts(notePath string) markdown.RenderOptions {
	return markdown.RenderOptions{
		NotePath:  notePath,
		NoteIndex: h.noteIndex(),
		LoadDatabase: func(name string) (*database.Table, error) {
			return h.databases.Get(name)
		},
	}
}

func (h *Handlers) handleHome(w http.ResponseWriter, r *http.Request) {
	data := h.pageData("library")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = templates.Layout(data).Render(r.Context(), w)
}

func (h *Handlers) handleDatabasesHome(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (h *Handlers) handleNote(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(chi.URLParam(r, "*"), "/")
	note, err := h.notes.Get(path)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	attachList, _ := h.attachments.List(path)
	var attachments []templates.AttachmentItem
	for _, a := range attachList {
		attachments = append(attachments, templates.AttachmentItem{
			Name: a.Name,
			URL:  fmt.Sprintf("/api/files/%s/%s", path, a.Name),
			Size: a.Size,
		})
	}
	excalFiles, _ := h.excalidraw.ListForNote(path)
	html := string(markdown.Render(note.Content, h.renderOpts(path)))
	backlinks, tags, tasks, jPrev, jNext := h.noteMeta(path, note.Content)

	np := templates.NotePage{
		Path: path, Title: note.Title, Content: note.Content,
		HTML: html, Attachments: attachments, Excalidraw: excalFiles,
		Backlinks: backlinks, Tags: tags, Tasks: tasks,
		JournalPrev: jPrev, JournalNext: jNext,
	}

	if r.Header.Get("HX-Request") == "true" {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_ = templates.MarkdownDocumentEditor("note", np.Path, np.Title, np.Content, &np).Render(r.Context(), w)
		return
	}

	data := h.pageData("library")
	data.Items = markActiveItem(data.Items, "note", path)
	data.FolderSections = markActiveSections(data.FolderSections, "note", path)
	for i := range data.Notes {
		data.Notes[i].Active = data.Notes[i].Path == path
	}
	data.Note = &np
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = templates.Layout(data).Render(r.Context(), w)
}

func (h *Handlers) handleSaveNote(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(chi.URLParam(r, "*"), "/")
	content := r.FormValue("content")
	if content == "" {
		body, _ := io.ReadAll(r.Body)
		var payload struct {
			Content string `json:"content"`
		}
		_ = json.Unmarshal(body, &payload)
		content = payload.Content
	}
	if _, err := h.notes.Save(path, content); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	if r.Header.Get("HX-Request") == "true" {
		w.WriteHeader(http.StatusOK)
		return
	}
	http.Redirect(w, r, "/notes/"+path, http.StatusSeeOther)
}

func (h *Handlers) handleDatabase(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(chi.URLParam(r, "*"), "/")
	table, err := h.databases.Get(name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	content := database.ToMarkdown(table)
	title := table.Name
	if base := filepath.Base(table.Name); base != "" && base != "." {
		title = base
	}
	dp := templates.DatabasePage{
		Name:    table.Name,
		Path:    table.Name,
		Title:   title,
		Content: content,
	}

	if r.Header.Get("HX-Request") == "true" {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_ = templates.MarkdownDocumentEditor("database", dp.Path, dp.Title, dp.Content, nil).Render(r.Context(), w)
		return
	}

	data := h.pageData("library")
	data.Items = markActiveItem(data.Items, "database", name)
	data.FolderSections = markActiveSections(data.FolderSections, "database", name)
	for i := range data.Databases {
		data.Databases[i].Active = data.Databases[i].Name == name
	}
	data.Database = &dp
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = templates.Layout(data).Render(r.Context(), w)
}

func (h *Handlers) handleSaveDatabase(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(chi.URLParam(r, "*"), "/")
	body, _ := io.ReadAll(r.Body)
	var payload struct {
		Content string     `json:"content"`
		Headers []string   `json:"headers"`
		Rows    [][]string `json:"rows"`
	}
	if len(body) > 0 {
		_ = json.Unmarshal(body, &payload)
	}
	if payload.Content == "" {
		form := r.FormValue("payload")
		if form != "" {
			_ = json.Unmarshal([]byte(form), &payload)
		}
	}
	var err error
	if payload.Content != "" {
		_, err = database.SaveMarkdown(h.databases, name, payload.Content)
	} else {
		_, err = h.databases.Save(name, payload.Headers, payload.Rows)
	}
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	if r.Header.Get("HX-Request") == "true" {
		w.WriteHeader(http.StatusOK)
		return
	}
	http.Redirect(w, r, "/databases/"+name, http.StatusSeeOther)
}

func (h *Handlers) handleSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	results, _ := h.search.Query(q)
	var items []templates.SearchResult
	for _, res := range results {
		items = append(items, templates.SearchResult{
			Path: res.Path, Title: res.Title, Type: res.Type, Snippet: res.Snippet,
		})
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if r.Header.Get("HX-Request") == "true" {
		_ = templates.SearchPartial(items).Render(r.Context(), w)
		return
	}
	data := h.pageData("notes")
	data.SearchQ = q
	data.Results = items
	_ = templates.Layout(data).Render(r.Context(), w)
}

func (h *Handlers) handleUploadAttachment(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(chi.URLParam(r, "*"), "/")
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	defer file.Close()
	if _, err := h.attachments.Save(path, header.Filename, file); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	list, _ := h.attachments.List(path)
	var items []templates.AttachmentItem
	for _, a := range list {
		items = append(items, templates.AttachmentItem{
			Name: a.Name, URL: fmt.Sprintf("/api/files/%s/%s", path, a.Name), Size: a.Size,
		})
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = templates.AttachmentList(items).Render(r.Context(), w)
}

func (h *Handlers) handlePreview(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(chi.URLParam(r, "*"), "/")
	if path == "" {
		http.NotFound(w, r)
		return
	}
	// Avoid orphan HTML documents (browser tab shows a raw HTML file icon).
	if r.Header.Get("HX-Request") != "true" {
		http.Redirect(w, r, "/notes/"+path, http.StatusSeeOther)
		return
	}
	note, err := h.notes.Get(path)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	h.writePreviewHTML(w, note.Content, path)
}

func (h *Handlers) handlePreviewBody(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Content string `json:"content"`
		Path    string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	path := strings.Trim(payload.Path, "/")
	if path == "" {
		path = "preview.md"
	}
	h.writePreviewHTML(w, payload.Content, path)
}

func (h *Handlers) writePreviewHTML(w http.ResponseWriter, content, notePath string) {
	html := string(markdown.Render(content, h.renderOpts(notePath)))
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(`<div class="markdown-preview-inner">` + html + `</div>`))
}

func (h *Handlers) handleExcalidraw(w http.ResponseWriter, r *http.Request) {
	note := chi.URLParam(r, "note")
	file := strings.TrimPrefix(chi.URLParam(r, "*"), "/")
	data, err := h.excalidraw.Load(note, file)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(data)
}

func (h *Handlers) handleSyncStatus(w http.ResponseWriter, r *http.Request) {
	since := time.Now().Add(-24 * time.Hour)
	if t := r.URL.Query().Get("since"); t != "" {
		if parsed, err := time.Parse(time.RFC3339, t); err == nil {
			since = parsed
		}
	}
	changes, _ := h.sync.ChangesSince(since)
	last := "now"
	if len(changes) > 0 {
		last = changes[0].Modified.Format("15:04")
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = templates.SyncStatus(last, len(changes)).Render(r.Context(), w)
}

func (h *Handlers) handleConnectors(w http.ResponseWriter, r *http.Request) {
	data := h.pageData("connectors")
	headroomOK := false
	if h.connectors != nil {
		cfg := h.connectors.Config()
		headroomOK = ai.HeadroomPing(cfg.AI.HeadroomURL)
		data.Connectors = h.connectors.Status(headroomOK)
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if r.Header.Get("HX-Request") != "" {
		_ = templates.ConnectorsPanel(data.Connectors).Render(r.Context(), w)
		return
	}
	_ = templates.Layout(data).Render(r.Context(), w)
}

func (h *Handlers) handleJournalToday(w http.ResponseWriter, r *http.Request) {
	path, err := h.ensureDailyNote(time.Now())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, "/notes/"+path, http.StatusSeeOther)
}

func (h *Handlers) handleJournalWeek(w http.ResponseWriter, r *http.Request) {
	path, err := h.ensureWeeklyNote(time.Now())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, "/notes/"+path, http.StatusSeeOther)
}

func (h *Handlers) handleJournalDate(w http.ResponseWriter, r *http.Request) {
	date := chi.URLParam(r, "date")
	day, err := journal.ParseDate(date)
	if err != nil {
		day, err = time.Parse("2006-01-02", date)
		if err != nil {
			http.NotFound(w, r)
			return
		}
	}
	path, err := h.ensureDailyNote(day)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, "/notes/"+path, http.StatusSeeOther)
}

func (h *Handlers) handleTasks(w http.ResponseWriter, r *http.Request) {
	tasks, _ := vaultparse.ListOpenTasks(h.vault)
	var items []templates.OpenTaskItem
	for _, t := range tasks {
		items = append(items, templates.OpenTaskItem{
			Path: t.Path, Text: t.Text, Schedule: t.Schedule,
		})
	}
	if items == nil {
		items = []templates.OpenTaskItem{}
	}
	data := h.pageData("tasks")
	data.OpenTasks = items
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if r.Header.Get("HX-Request") == "true" {
		_ = templates.TasksInbox(items).Render(r.Context(), w)
		return
	}
	_ = templates.Layout(data).Render(r.Context(), w)
}

func (h *Handlers) handleTag(w http.ResponseWriter, r *http.Request) {
	tag := strings.ToLower(chi.URLParam(r, "tag"))
	noteList, _ := h.notes.List()
	var results []templates.SearchResult
	for _, n := range noteList {
		note, err := h.notes.Get(n.Path)
		if err != nil {
			continue
		}
		for _, t := range vaultparse.ExtractTags(note.Content) {
			if t == tag {
				results = append(results, templates.SearchResult{
					Path: n.Path, Title: n.Title, Type: "note", Snippet: "#" + tag,
				})
				break
			}
		}
	}
	data := h.pageData("library")
	data.ActiveTag = tag
	data.Results = results
	data.SearchQ = "#" + tag
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = templates.Layout(data).Render(r.Context(), w)
}

func (h *Handlers) handleReveal(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Kind string `json:"kind"`
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var abs string
	var err error
	switch req.Kind {
	case "note":
		abs, err = h.vault.NoteAbsPath(req.Path)
	case "database":
		abs, err = h.vault.DatabaseAbsPath(req.Path)
	default:
		http.Error(w, "kind must be note or database", http.StatusBadRequest)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := vault.RevealInFinder(abs); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"path": abs})
}

// API sync endpoints (JSON)
func (h *Handlers) MountSyncAPI(r chi.Router) {
	r.Get("/changes", h.apiSyncChanges)
	r.Post("/pull", h.apiSyncPull)
	r.Post("/push", h.apiSyncPush)
}

func (h *Handlers) apiSyncChanges(w http.ResponseWriter, r *http.Request) {
	since := time.Time{}
	if t := r.URL.Query().Get("since"); t != "" {
		since, _ = time.Parse(time.RFC3339, t)
	}
	changes, err := h.sync.ChangesSince(since)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, changes)
}

func (h *Handlers) apiSyncPull(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Paths []string `json:"paths"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	files, err := h.sync.Pull(body.Paths)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, files)
}

func (h *Handlers) apiSyncPush(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Files []sync.FilePayload `json:"files"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error()})
		return
	}
	changes, err := h.sync.Push(body.Files)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, 200, changes)
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

var _ = strings.TrimSpace
