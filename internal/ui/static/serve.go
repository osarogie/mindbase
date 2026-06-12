package static

import (
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
)

// Dir is the on-disk static asset folder (used in dev when present).
const Dir = "internal/ui/static"

// Handler serves CSS/JS/icons. Prefers the working-tree directory when it exists
// so `make dev` picks up app.js/app.css edits without rebuilding the embed FS.
func Handler() http.Handler {
	if root, ok := diskRoot(); ok {
		return http.StripPrefix("/static/", http.FileServer(http.Dir(root)))
	}
	return http.StripPrefix("/static/", http.FileServer(http.FS(Files)))
}

func diskRoot() (string, bool) {
	candidates := []string{Dir}
	if wd, err := os.Getwd(); err == nil {
		candidates = append(candidates, filepath.Join(wd, Dir))
	}
	for _, root := range candidates {
		if st, err := os.Stat(filepath.Join(root, "app.js")); err == nil && !st.IsDir() {
			return root, true
		}
	}
	return "", false
}

// MustSub returns the embedded icons subtree (for tests/tools).
func MustSub(pattern string) fs.FS {
	sub, err := fs.Sub(Files, pattern)
	if err != nil {
		panic(err)
	}
	return sub
}
