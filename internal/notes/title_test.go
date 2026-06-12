package notes_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/osarogie/mindbase/internal/notes"
	"github.com/osarogie/mindbase/internal/vault"
)

func TestListUsesH1Title(t *testing.T) {
	root := t.TempDir()
	notesRoot := filepath.Join(root, "notes")
	if err := os.MkdirAll(notesRoot, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(notesRoot, "page-2026.md"), []byte("# My Real Title\n\nBody\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	v, err := vault.Open(root)
	if err != nil {
		t.Fatal(err)
	}
	list, err := notes.NewService(v).List()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 {
		t.Fatalf("entries: %d", len(list))
	}
	if list[0].Title != "My Real Title" {
		t.Fatalf("title = %q, want My Real Title", list[0].Title)
	}
}
