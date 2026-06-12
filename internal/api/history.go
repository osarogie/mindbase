package api

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/osarogie/mindbase/internal/vaultgit"
)

func (s *Server) handleHistoryLog(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimSpace(r.URL.Query().Get("path"))
	limit := 30
	if n, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && n > 0 {
		limit = n
	}
	if limit > 100 {
		limit = 100
	}

	commits, err := vaultgit.Log(s.vault.Root, vaultgit.LogOptions{
		Limit: limit,
		Path:  path,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, map[string]any{
		"path":     path,
		"has_repo": vaultgit.HasRepo(s.vault.Root),
		"commits":  commits,
	})
}

func (s *Server) handleHistorySnapshot(w http.ResponseWriter, r *http.Request) {
	rev := chi.URLParam(r, "rev")
	path := strings.TrimSpace(r.URL.Query().Get("path"))
	if rev == "" || path == "" {
		writeError(w, http.StatusBadRequest, errString("rev and path required"))
		return
	}
	content, err := vaultgit.FileAtRev(s.vault.Root, rev, path)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, map[string]string{
		"rev":     rev,
		"path":    path,
		"content": content,
	})
}

type errString string

func (e errString) Error() string { return string(e) }
