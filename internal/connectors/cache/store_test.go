package cache

import (
	"testing"
	"time"

	"github.com/osarogie/mindbase/internal/vault"
)

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
