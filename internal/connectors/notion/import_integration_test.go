package notion

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/osarogie/mindbase/internal/connectors/cache"
	"github.com/osarogie/mindbase/internal/vault"
)

// fakeNotion serves a minimal Notion API: one page with one paragraph block.
func fakeNotion(t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/search":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"results": []map[string]any{{
					"id":     "page-1",
					"object": "page",
					"url":    "https://notion.so/page-1",
					"properties": map[string]any{
						"Name": map[string]any{
							"type":  "title",
							"title": []map[string]any{{"plain_text": "My Page"}},
						},
					},
				}},
				"has_more": false,
			})
		case r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/blocks/"):
			_ = json.NewEncoder(w).Encode(map[string]any{
				"results": []map[string]any{{
					"id":   "b1",
					"type": "paragraph",
					"paragraph": map[string]any{
						"rich_text": []map[string]any{{"plain_text": "Hello world"}},
					},
				}},
				"has_more": false,
			})
		default:
			http.NotFound(w, r)
		}
	}))
}

func TestSyncImportsBlockText(t *testing.T) {
	srv := fakeNotion(t)
	defer srv.Close()

	v, err := vault.Open(t.TempDir())
	if err != nil {
		t.Fatalf("open vault: %v", err)
	}
	store := cache.New(v)
	client := &Client{token: "x", http: srv.Client(), ver: "test", base: srv.URL}

	res, err := syncWithClient(v, store, client, "notion")
	if err != nil {
		t.Fatalf("sync: %v", err)
	}
	if res.Imported != 1 {
		t.Fatalf("Imported=%d, want 1 (errors=%v)", res.Imported, res.Errors)
	}

	matches, err := filepath.Glob(filepath.Join(v.NotesRoot(), "notion", "*.md"))
	if err != nil {
		t.Fatalf("glob: %v", err)
	}
	if len(matches) != 1 {
		t.Fatalf("expected 1 imported file, got %v", matches)
	}
	data, err := os.ReadFile(matches[0])
	if err != nil {
		t.Fatalf("read imported note: %v", err)
	}
	if !strings.Contains(string(data), "Hello world") {
		t.Errorf("imported note is missing the block text 'Hello world':\n%s", data)
	}
}

func TestSyncIsIdempotent(t *testing.T) {
	srv := fakeNotion(t)
	defer srv.Close()

	v, err := vault.Open(t.TempDir())
	if err != nil {
		t.Fatalf("open vault: %v", err)
	}
	store := cache.New(v)
	client := &Client{token: "x", http: srv.Client(), ver: "test", base: srv.URL}

	if _, err := syncWithClient(v, store, client, "notion"); err != nil {
		t.Fatalf("first sync: %v", err)
	}
	// Second sync with an unchanged page should re-skip via the cache, not
	// re-import or create a duplicate file.
	res2, err := syncWithClient(v, store, client, "notion")
	if err != nil {
		t.Fatalf("second sync: %v", err)
	}
	if res2.Imported != 0 {
		t.Errorf("second sync Imported=%d, want 0 (should be cached)", res2.Imported)
	}
	matches, err := filepath.Glob(filepath.Join(v.NotesRoot(), "notion", "*.md"))
	if err != nil {
		t.Fatalf("glob: %v", err)
	}
	if len(matches) != 1 {
		t.Errorf("expected 1 file after re-sync, got %d: %v", len(matches), matches)
	}
}
