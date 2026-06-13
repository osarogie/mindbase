package gdrive

import (
	"strings"
	"testing"

	"github.com/osarogie/mindbase/internal/vault"
)

func TestShouldPull(t *testing.T) {
	cases := []struct {
		rel        string
		notes, dbs bool
		want       bool
	}{
		{"notion/page.md", true, false, true},
		{"notion/page.md", false, false, false},
		{"databases/people.csv", false, true, true},
		{"databases/people.csv", true, false, false},
		{"welcome.md", true, true, true},
	}
	for _, c := range cases {
		if got := shouldPull(c.rel, c.notes, c.dbs); got != c.want {
			t.Errorf("shouldPull(%q, notes=%v, dbs=%v) = %v, want %v", c.rel, c.notes, c.dbs, got, c.want)
		}
	}
}

func TestResolveLocalPath(t *testing.T) {
	v, err := vault.Open(t.TempDir())
	if err != nil {
		t.Fatalf("open vault: %v", err)
	}

	notePath, err := resolveLocalPath(v, "notion/page.md")
	if err != nil {
		t.Fatalf("resolveLocalPath note: %v", err)
	}
	if !strings.HasPrefix(notePath, v.NotesRoot()) {
		t.Errorf("note path %q not under NotesRoot %q", notePath, v.NotesRoot())
	}

	dbPath, err := resolveLocalPath(v, "databases/people.csv")
	if err != nil {
		t.Fatalf("resolveLocalPath db: %v", err)
	}
	if !strings.HasPrefix(dbPath, v.DatabasesRoot()) {
		t.Errorf("db path %q not under DatabasesRoot %q", dbPath, v.DatabasesRoot())
	}

	// Path traversal in a remote file name must be rejected, never resolved to
	// somewhere outside the vault.
	if _, err := resolveLocalPath(v, "../../../etc/passwd"); err == nil {
		t.Error("resolveLocalPath allowed path traversal, want error")
	}
}
