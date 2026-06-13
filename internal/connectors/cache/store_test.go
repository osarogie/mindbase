package cache

import (
	"sync"
	"testing"
	"time"

	"github.com/osarogie/mindbase/internal/vault"
)

// Concurrent Update calls must not lose writes or corrupt index.json.
func TestUpdateConcurrent(t *testing.T) {
	v, err := vault.Open(t.TempDir())
	if err != nil {
		t.Fatalf("open vault: %v", err)
	}
	store := New(v)

	const n = 50
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(k int) {
			defer wg.Done()
			_, err := store.Update(func(idx *Index) {
				idx.Notion.Pages[string(rune('a'+k%26))+string(rune('0'+k/26))] = NotionPageEntry{}
			})
			if err != nil {
				t.Errorf("update: %v", err)
			}
		}(i)
	}
	wg.Wait()

	idx, err := store.Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if len(idx.Notion.Pages) != n {
		t.Errorf("lost writes under concurrency: got %d pages, want %d", len(idx.Notion.Pages), n)
	}
}

func TestResetNotion(t *testing.T) {
	v, err := vault.Open(t.TempDir())
	if err != nil {
		t.Fatalf("open vault: %v", err)
	}
	store := New(v)

	idx, err := store.Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	idx.Notion.Pages["p1"] = NotionPageEntry{Path: "notion/a.md", Title: "A", Modified: time.Now()}
	idx.Notion.Pages["p2"] = NotionPageEntry{Path: "notion/b.md", Title: "B"}
	idx.Notion.LastSync = time.Now()
	idx.GDrive.Files["notion/a.md"] = GDriveFileEntry{DriveID: "x"}
	if err := store.Save(idx); err != nil {
		t.Fatalf("save: %v", err)
	}

	cleared, err := store.ResetNotion()
	if err != nil {
		t.Fatalf("reset: %v", err)
	}
	if cleared != 2 {
		t.Errorf("cleared=%d, want 2", cleared)
	}

	got, _ := store.Load()
	if len(got.Notion.Pages) != 0 {
		t.Errorf("Notion.Pages not cleared: %v", got.Notion.Pages)
	}
	if !got.Notion.LastSync.IsZero() {
		t.Errorf("Notion.LastSync not reset: %v", got.Notion.LastSync)
	}
	// GDrive index must be left intact.
	if len(got.GDrive.Files) != 1 {
		t.Errorf("GDrive.Files should be untouched, got %v", got.GDrive.Files)
	}
}
