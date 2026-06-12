package snapshots

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRecordAndLog(t *testing.T) {
	root := t.TempDir()
	path := "notes/welcome.md"

	if err := Record(root, path, "# Hello\n", "Update note welcome.md"); err != nil {
		t.Fatal(err)
	}
	// Duplicate content should not create another entry.
	if err := Record(root, path, "# Hello\n", "Update note welcome.md"); err != nil {
		t.Fatal(err)
	}

	entries, err := Log(root, path, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 snapshot, got %d", len(entries))
	}

	if err := Record(root, path, "# Hello v2\n", "Update note welcome.md"); err != nil {
		t.Fatal(err)
	}
	entries, err = Log(root, path, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 {
		t.Fatalf("expected 2 snapshots, got %d", len(entries))
	}

	body, err := Content(root, path, entries[0].Hash)
	if err != nil {
		t.Fatal(err)
	}
	if body != "# Hello v2\n" {
		t.Fatalf("unexpected body: %q", body)
	}
}

func TestManifestOnDisk(t *testing.T) {
	root := t.TempDir()
	path := "welcome.md"
	if err := Record(root, path, "one", "save"); err != nil {
		t.Fatal(err)
	}
	manifest := filepath.Join(root, ".mindbase", "snapshots", "notes__welcome.md", "manifest.json")
	if _, err := os.Stat(manifest); err != nil {
		t.Fatalf("manifest missing: %v", err)
	}
}
