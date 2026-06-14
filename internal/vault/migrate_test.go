package vault

import (
	"os"
	"path/filepath"
	"testing"
)

func write(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func TestMigrateLegacyLayoutFlattensToRoot(t *testing.T) {
	root := t.TempDir()
	// Seed a legacy layout before opening the vault.
	write(t, filepath.Join(root, "notes", "a.md"), "# A")
	write(t, filepath.Join(root, "notes", "sub", "b.md"), "# B")
	write(t, filepath.Join(root, "notes", "notion", "p.md"), "# P")
	write(t, filepath.Join(root, "databases", "x.csv"), "id\n1\n")

	if _, err := Open(root); err != nil {
		t.Fatalf("open: %v", err)
	}

	for _, rel := range []string{"a.md", "sub/b.md", "notion/p.md", "x.csv"} {
		if !exists(filepath.Join(root, filepath.FromSlash(rel))) {
			t.Errorf("expected %s at root after migration", rel)
		}
	}
	if exists(filepath.Join(root, "notes")) {
		t.Errorf("legacy notes/ dir should be removed")
	}
	if exists(filepath.Join(root, "databases")) {
		t.Errorf("legacy databases/ dir should be removed")
	}
}

func TestMigrateLegacyLayoutNeverOverwrites(t *testing.T) {
	root := t.TempDir()
	// A file already at root collides with one inside notes/.
	write(t, filepath.Join(root, "a.md"), "ROOT")
	write(t, filepath.Join(root, "notes", "a.md"), "LEGACY")

	if _, err := Open(root); err != nil {
		t.Fatalf("open: %v", err)
	}

	got, _ := os.ReadFile(filepath.Join(root, "a.md"))
	if string(got) != "ROOT" {
		t.Errorf("root file must not be overwritten, got %q", got)
	}
	// The colliding legacy file is preserved (folder left intact).
	if !exists(filepath.Join(root, "notes", "a.md")) {
		t.Errorf("colliding legacy file should be preserved, not lost")
	}
}

func TestMigrateLegacyLayoutTypeCollision(t *testing.T) {
	root := t.TempDir()
	// Root has a FILE named "sub"; legacy notes/ has a DIRECTORY named "sub".
	// The migration must not error (which would abort vault open) and must not
	// overwrite the root file.
	write(t, filepath.Join(root, "sub"), "ROOT FILE")
	write(t, filepath.Join(root, "notes", "sub", "deep.md"), "# Deep")

	if _, err := Open(root); err != nil {
		t.Fatalf("open must not fail on a file/dir name collision: %v", err)
	}

	got, _ := os.ReadFile(filepath.Join(root, "sub"))
	if string(got) != "ROOT FILE" {
		t.Errorf("root file must be preserved, got %q", got)
	}
	// The colliding legacy subtree is left intact (not lost).
	if !exists(filepath.Join(root, "notes", "sub", "deep.md")) {
		t.Errorf("colliding legacy subtree should be preserved")
	}
}

func TestMigrateLegacyLayoutIdempotent(t *testing.T) {
	root := t.TempDir()
	write(t, filepath.Join(root, "notes", "a.md"), "# A")

	if _, err := Open(root); err != nil {
		t.Fatalf("open 1: %v", err)
	}
	// Second open must be a no-op and must not move a.md anywhere.
	if _, err := Open(root); err != nil {
		t.Fatalf("open 2: %v", err)
	}
	if !exists(filepath.Join(root, "a.md")) {
		t.Errorf("a.md should remain at root")
	}
}

func TestResolveRejectsReservedPaths(t *testing.T) {
	v, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, bad := range []string{".mindbase/config.json", ".git/config", ".mindbase"} {
		if _, err := v.ResolveNotePath(bad); err == nil {
			t.Errorf("ResolveNotePath(%q) should be rejected", bad)
		}
	}
	// A normal nested path still resolves.
	if _, err := v.ResolveNotePath("projects/ideas.md"); err != nil {
		t.Errorf("ResolveNotePath of a normal path failed: %v", err)
	}
}

func TestRootsAreUnified(t *testing.T) {
	v, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if v.NotesRoot() != v.Root || v.DatabasesRoot() != v.Root {
		t.Errorf("notes/databases roots should both equal the vault root")
	}
}
