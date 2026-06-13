package notion

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/osarogie/mindbase/internal/connectors/cache"
	"github.com/osarogie/mindbase/internal/vault"
)

type SyncResult struct {
	Imported int      `json:"imported"`
	Updated  int      `json:"updated"`
	Skipped  int      `json:"skipped"`
	Paths    []string `json:"paths"`
	Errors   []string `json:"errors,omitempty"`
	Cached   int      `json:"cached"`
}

// Sync pulls Notion pages into the local vault cache, updating only changed pages.
func Sync(v *vault.Vault, store *cache.Store, token, subdir string) (*SyncResult, error) {
	if token == "" {
		return nil, fmt.Errorf("notion token not configured")
	}
	client := NewClient(token)
	pages, err := client.SearchPages()
	if err != nil {
		return nil, err
	}

	idx, err := store.Load()
	if err != nil {
		return nil, err
	}

	destRoot := filepath.Join(v.NotesRoot(), subdir)
	if err := os.MkdirAll(destRoot, 0o755); err != nil {
		return nil, err
	}

	res := &SyncResult{}
	seen := map[string]bool{}

	for _, page := range pages {
		title := PageTitle(page)
		if title == "" || seen[page.ID] {
			res.Skipped++
			continue
		}
		seen[page.ID] = true

		entry, cached := idx.Notion.Pages[page.ID]
		if cached && !page.Modified.After(entry.Modified) {
			res.Skipped++
			res.Cached++
			continue
		}

		body, err := client.BlocksToMarkdown(page.ID, 0)
		if err != nil {
			res.Errors = append(res.Errors, fmt.Sprintf("%s: %v", title, err))
			continue
		}

		relPath := stablePath(subdir, page.ID, title, entry.Path)
		full := filepath.Join(v.NotesRoot(), relPath)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			res.Errors = append(res.Errors, fmt.Sprintf("%s: %v", title, err))
			continue
		}

		content := buildNote(title, page, body)
		if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
			res.Errors = append(res.Errors, fmt.Sprintf("%s: %v", title, err))
			continue
		}

		now := time.Now().UTC()
		idx.Notion.Pages[page.ID] = cache.NotionPageEntry{
			Path:     relPath,
			Title:    title,
			Modified: page.Modified,
			CachedAt: now,
			URL:      page.URL,
		}

		if cached {
			res.Updated++
		} else {
			res.Imported++
		}
		res.Paths = append(res.Paths, relPath)
	}

	idx.Notion.LastSync = time.Now().UTC()
	if err := store.Save(idx); err != nil {
		return res, err
	}
	return res, nil
}

func stablePath(subdir, pageID, title, existing string) string {
	if existing != "" {
		return filepath.ToSlash(existing)
	}
	id := strings.ReplaceAll(pageID, "-", "")
	if len(id) > 8 {
		id = id[:8]
	}
	if id == "" {
		id = "page"
	}
	base := slug(title)
	if base == "" {
		base = "page"
	}
	return filepath.ToSlash(filepath.Join(subdir, base+"-"+id+".md"))
}

// Import is a full sync alias for backward compatibility.
func Import(v *vault.Vault, token, subdir string) (*ImportResult, error) {
	store := cache.New(v)
	syncRes, err := Sync(v, store, token, subdir)
	if err != nil {
		return nil, err
	}
	return &ImportResult{
		Imported: syncRes.Imported + syncRes.Updated,
		Skipped:  syncRes.Skipped,
		Paths:    syncRes.Paths,
		Errors:   syncRes.Errors,
	}, nil
}
