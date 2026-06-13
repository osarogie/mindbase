package notion

import "testing"

func TestSlug(t *testing.T) {
	cases := map[string]string{
		"Hello World":     "hello-world",
		"  Trimmed  ":     "trimmed",
		"Weird/Chars!#?":  "weirdchars",
		"Café Déjà":       "caf-dj",
		"UPPER case":      "upper-case",
		"":                "untitled",
		"!!!":             "untitled",
		"multi   space":   "multi---space",
		"keep-dashes-123": "keep-dashes-123",
	}
	for in, want := range cases {
		if got := slug(in); got != want {
			t.Errorf("slug(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestStablePath(t *testing.T) {
	const id = "11112222-3333-4444-5555-666677778888"

	// Same page id + title must map to the same path across syncs (idempotent),
	// so a re-sync overwrites in place rather than creating duplicates on Drive.
	p1 := stablePath("notion", id, "My Page", "")
	p2 := stablePath("notion", id, "My Page", "")
	if p1 != p2 {
		t.Fatalf("stablePath not deterministic: %q vs %q", p1, p2)
	}
	if want := "notion/my-page-11112222.md"; p1 != want {
		t.Errorf("stablePath = %q, want %q", p1, want)
	}

	// An existing mapping is preserved even if the title changes, so renaming a
	// Notion page does not orphan/duplicate the file.
	got := stablePath("notion", id, "Renamed Title", "notion/my-page-11112222.md")
	if got != "notion/my-page-11112222.md" {
		t.Errorf("stablePath with existing = %q, want preserved original", got)
	}

	// Untitled pages still get a stable, non-empty path (slug("") -> "untitled").
	if got := stablePath("notion", id, "", ""); got != "notion/untitled-11112222.md" {
		t.Errorf("stablePath untitled = %q, want notion/untitled-11112222.md", got)
	}
}

func TestStablePathShortIDNoPanic(t *testing.T) {
	// A malformed/short page id must not panic the sync (was id[:8]).
	if got := stablePath("notion", "abc", "Title", ""); got != "notion/title-abc.md" {
		t.Errorf("stablePath short id = %q, want notion/title-abc.md", got)
	}
	if got := stablePath("notion", "", "Title", ""); got != "notion/title-page.md" {
		t.Errorf("stablePath empty id = %q, want notion/title-page.md", got)
	}
}

func TestPageTitle(t *testing.T) {
	page := Page{Properties: Properties{
		"Name": Property{Type: "title", Title: []Rich{{Plain: "  Hello  "}}},
		"Tags": Property{Type: "multi_select"},
	}}
	if got := PageTitle(page); got != "Hello" {
		t.Errorf("PageTitle = %q, want Hello", got)
	}
	if got := PageTitle(Page{}); got != "Untitled" {
		t.Errorf("PageTitle empty = %q, want Untitled", got)
	}
}
