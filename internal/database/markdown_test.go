package database

import "testing"

func TestToMarkdownFromMarkdownRoundTrip(t *testing.T) {
	table := &Table{
		Name:    "projects",
		Headers: []string{"name", "status", "_page"},
		Rows: [][]string{
			{"Alpha", "active", "welcome"},
			{"Beta", "done", "ideas/note"},
		},
	}
	md := ToMarkdown(table)
	parsed, err := FromMarkdown(md, "projects")
	if err != nil {
		t.Fatal(err)
	}
	if len(parsed.Headers) != 3 {
		t.Fatalf("headers: got %d want 3", len(parsed.Headers))
	}
	if len(parsed.Rows) != 2 {
		t.Fatalf("rows: got %d want 2", len(parsed.Rows))
	}
	if parsed.Rows[0][0] != "Alpha" {
		t.Fatalf("row0: %q", parsed.Rows[0][0])
	}
}

func TestFromMarkdownEmptyTable(t *testing.T) {
	parsed, err := FromMarkdown("# empty\n\nNo table yet.", "empty")
	if err != nil {
		t.Fatal(err)
	}
	if len(parsed.Headers) != 0 {
		t.Fatalf("expected no headers, got %v", parsed.Headers)
	}
}

func TestEscapeCells(t *testing.T) {
	escaped := escapeCells([]string{"a|b", "plain"})
	if escaped[0] != "a\\|b" {
		t.Fatalf("escape: %q", escaped[0])
	}
}
