package webui

import (
	"embed"
	"io/fs"
	"strings"
)

// Dist holds the production React SPA (populated by `make react-ui`).
//
//go:embed all:dist
var dist embed.FS

// FS returns the embedded SPA filesystem, or false if dist is empty/unavailable.
func FS() (fs.FS, bool) {
	sub, err := fs.Sub(dist, "dist")
	if err != nil {
		return nil, false
	}
	entries, err := fs.ReadDir(sub, ".")
	if err != nil || len(entries) == 0 {
		return nil, false
	}
	if _, err := fs.Stat(sub, "index.html"); err != nil {
		return nil, false
	}
	if !hasProductionAssets(sub) {
		return nil, false
	}
	return sub, true
}

func hasProductionAssets(fsys fs.FS) bool {
	entries, err := fs.ReadDir(fsys, "assets")
	if err != nil || len(entries) == 0 {
		return false
	}
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".js") {
			return true
		}
	}
	return false
}
