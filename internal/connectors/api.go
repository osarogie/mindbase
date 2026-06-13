package connectors

import (
	"encoding/json"
	"net/http"

	"github.com/osarogie/mindbase/internal/ai"
)

type API struct {
	svc *Service
}

func NewAPI(svc *Service) *API {
	return &API{svc: svc}
}

func (a *API) Mount(r chiRouter) {
	r.Get("/status", a.handleStatus)
	r.Get("/config", a.handleGetConfig)
	r.Put("/config", a.handlePutConfig)
	r.Get("/credentials", a.handleGetCredentials)
	r.Put("/credentials", a.handlePutCredentials)
	r.Get("/gdrive/oauth/start", a.handleGDriveOAuthStart)
	r.Get("/gdrive/oauth/callback", a.handleGDriveOAuthCallback)
	r.Get("/notion/oauth/start", a.handleNotionOAuthStart)
	r.Get("/notion/oauth/callback", a.handleNotionOAuthCallback)
	r.Post("/notion/import", a.handleNotionImport)
	r.Post("/notion/reset", a.handleNotionReset)
	r.Post("/gdrive/sync", a.handleGDriveSync)
	r.Post("/sync", a.handleSyncAll)
	r.Get("/cache", a.handleCache)
	r.Post("/ai/chat", a.handleAIChat)
}

type chiRouter interface {
	Get(pattern string, h http.HandlerFunc)
	Put(pattern string, h http.HandlerFunc)
	Post(pattern string, h http.HandlerFunc)
}

func (a *API) handleStatus(w http.ResponseWriter, r *http.Request) {
	headroomOK := ai.HeadroomPing(a.svc.Config().AI.HeadroomURL)
	writeJSON(w, a.svc.Status(headroomOK))
}

func (a *API) handleGetConfig(w http.ResponseWriter, r *http.Request) {
	cfg := a.svc.Config()
	// Never expose secrets — config only has env var names
	writeJSON(w, cfg)
}

func (a *API) handlePutConfig(w http.ResponseWriter, r *http.Request) {
	var cfg Config
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if cfg.Version == 0 {
		cfg.Version = 1
	}
	cfg = normalizeSourceSink(cfg)
	if err := ValidateSourceSink(cfg); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if err := a.svc.UpdateConfig(cfg); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, cfg)
}

func (a *API) handleGetCredentials(w http.ResponseWriter, r *http.Request) {
	view, err := a.svc.CredentialsView()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, view)
}

func (a *API) handlePutCredentials(w http.ResponseWriter, r *http.Request) {
	var req UpdateCredentialsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	view, err := a.svc.UpdateCredentials(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, view)
}

func (a *API) handleGDriveOAuthStart(w http.ResponseWriter, r *http.Request) {
	redirectURI := r.URL.Query().Get("redirect_uri")
	if redirectURI == "" {
		scheme := "http"
		if r.TLS != nil {
			scheme = "https"
		}
		redirectURI = scheme + "://" + r.Host + "/api/connectors/gdrive/oauth/callback"
	}
	url, _, err := a.svc.GDriveOAuthStart(redirectURI)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, map[string]string{"auth_url": url})
}

func (a *API) handleGDriveOAuthCallback(w http.ResponseWriter, r *http.Request) {
	if err := a.svc.GDriveOAuthCallback(r); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(`<!DOCTYPE html><html><body><h2>Google Drive connected</h2><p>You can close this window and return to mindbase.</p><script>setTimeout(()=>window.close(),1500)</script></body></html>`))
}

func (a *API) handleNotionOAuthStart(w http.ResponseWriter, r *http.Request) {
	redirectURI := r.URL.Query().Get("redirect_uri")
	if redirectURI == "" {
		scheme := "http"
		if r.TLS != nil {
			scheme = "https"
		}
		redirectURI = scheme + "://" + r.Host + "/api/connectors/notion/oauth/callback"
	}
	url, _, err := a.svc.NotionOAuthStart(redirectURI)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, map[string]string{"auth_url": url})
}

func (a *API) handleNotionOAuthCallback(w http.ResponseWriter, r *http.Request) {
	if err := a.svc.NotionOAuthCallback(r); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(`<!DOCTYPE html><html><body><h2>Notion connected</h2><p>You can close this window and return to mindbase.</p><script>setTimeout(()=>window.close(),1500)</script></body></html>`))
}

func (a *API) handleNotionImport(w http.ResponseWriter, r *http.Request) {
	creds := resolveCredentials(a.svc.Vault(), a.svc.Config())
	if creds.NotionToken == "" {
		writeError(w, http.StatusBadRequest, errNotionDisabled)
		return
	}
	res, err := a.svc.ImportNotion()
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, res)
}

func (a *API) handleNotionReset(w http.ResponseWriter, r *http.Request) {
	creds := resolveCredentials(a.svc.Vault(), a.svc.Config())
	if creds.NotionToken == "" {
		writeError(w, http.StatusBadRequest, errNotionDisabled)
		return
	}
	cleared, err := a.svc.ResetNotionCache()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, map[string]any{"cleared": cleared})
}

func (a *API) handleGDriveSync(w http.ResponseWriter, r *http.Request) {
	creds := resolveCredentials(a.svc.Vault(), a.svc.Config())
	if creds.GDriveCredJSON == "" {
		writeError(w, http.StatusBadRequest, errGDriveDisabled)
		return
	}
	res, err := a.svc.SyncGDrive()
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, res)
}

func (a *API) handleSyncAll(w http.ResponseWriter, r *http.Request) {
	res, err := a.svc.SyncAll(r.Context())
	if err != nil {
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, res)
}

func (a *API) handleCache(w http.ResponseWriter, r *http.Request) {
	stats, err := a.svc.CacheStats()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, stats)
}

func (a *API) handleAIChat(w http.ResponseWriter, r *http.Request) {
	aiCfg := a.svc.Config().AI
	if !aiCfg.Enabled {
		writeError(w, http.StatusBadRequest, errAIDisabled)
		return
	}
	var req ai.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	res, err := a.svc.AIChat(r.Context(), req)
	if err != nil {
		if err.Error() == "ai assistant disabled" {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		writeError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, res)
}

var (
	errNotionDisabled = &apiError{msg: "notion connector disabled"}
	errGDriveDisabled = &apiError{msg: "google drive connector disabled"}
	errAIDisabled     = &apiError{msg: "ai assistant disabled"}
)

type apiError struct{ msg string }

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
