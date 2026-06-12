package vaultgit

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestTrackCommitsNoteChange(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	root := t.TempDir()
	notePath := filepath.Join(root, "notes", "hello.md")
	if err := os.MkdirAll(filepath.Dir(notePath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(notePath, []byte("# hello\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := Ensure(root); err != nil {
		t.Fatal(err)
	}
	if err := Track(root, []string{NotePath("hello.md")}, "Add hello note"); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(notePath, []byte("# hello world\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := Track(root, []string{NotePath("hello.md")}, "Update hello note"); err != nil {
		t.Fatal(err)
	}
	out, err := gitOutput(root, "log", "--oneline")
	if err != nil {
		t.Fatal(err)
	}
	if !containsLines(out, 2) {
		t.Fatalf("expected at least 2 commits, got log:\n%s", out)
	}
}

func containsLines(s string, n int) bool {
	count := 0
	for _, line := range splitLines(s) {
		if line != "" {
			count++
		}
	}
	return count >= n
}
