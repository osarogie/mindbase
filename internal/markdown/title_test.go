package markdown

import "testing"

func TestTitleFromContent(t *testing.T) {
	tests := []struct {
		content  string
		fallback string
		want     string
	}{
		{"# Hello\n\nBody", "page.md", "Hello"},
		{"Intro\n# Real title\n", "page.md", "Real title"},
		{"## Section title\n\nBody", "page.md", "Section title"},
		{
			"---\ntitle: Front matter\n---\n\n# Ignored\n",
			"page.md",
			"Front matter",
		},
		{"No heading", "my-note", "my-note"},
		{"#   \n", "fallback", "fallback"},
		{"", "untitled.md", "untitled.md"},
	}
	for _, tc := range tests {
		if got := TitleFromContent(tc.content, tc.fallback); got != tc.want {
			t.Fatalf("TitleFromContent(%q, %q) = %q, want %q", tc.content, tc.fallback, got, tc.want)
		}
	}
}

func TestTitleLooksLikePath(t *testing.T) {
	if !TitleLooksLikePath("page-2026", "notes/page-2026.md") {
		t.Fatal("expected filename fallback")
	}
	if TitleLooksLikePath("My Page", "notes/page-2026.md") {
		t.Fatal("expected real title")
	}
}
