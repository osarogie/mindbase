package vaultgit

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestLogAndStatus(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	root := t.TempDir()
	notePath := filepath.Join(root, "notes", "alpha.md")
	if err := os.MkdirAll(filepath.Dir(notePath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(notePath, []byte("# alpha\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := Ensure(root); err != nil {
		t.Fatal(err)
	}
	if err := Track(root, []string{NotePath("alpha.md")}, "Add alpha"); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(notePath, []byte("# alpha beta\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := Track(root, []string{NotePath("alpha.md")}, "Update alpha"); err != nil {
		t.Fatal(err)
	}

	commits, err := Log(root, LogOptions{Limit: 5})
	if err != nil {
		t.Fatal(err)
	}
	if len(commits) < 2 {
		t.Fatalf("expected >=2 commits, got %d", len(commits))
	}
	if commits[0].Subject != "Update alpha" {
		t.Fatalf("latest subject = %q", commits[0].Subject)
	}

	lines, err := Status(root)
	if err != nil {
		t.Fatal(err)
	}
	for _, line := range lines {
		if line.Path != ".gitignore" {
			t.Fatalf("unexpected dirty file: %#v", lines)
		}
	}

	patch, err := Show(root, "HEAD")
	if err != nil || patch == "" {
		t.Fatalf("show HEAD: err=%v len=%d", err, len(patch))
	}
}

func TestFormatCommitOneline(t *testing.T) {
	line := FormatCommitOneline(Commit{
		Short:   "abc1234",
		Date:    "2026-06-12T10:00:00Z",
		Subject: "Update note",
	})
	if line == "" {
		t.Fatal("empty oneline")
	}
}
