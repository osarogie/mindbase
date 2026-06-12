package editor

import (
	"strings"
	"testing"

	"github.com/osarogie/mindbase/internal/markdown"
)

func TestBuildPageAndRoundtrip(t *testing.T) {
	src := "# Hello\n\n- [ ] Task one\n\n**Bold** text"
	page := BuildPage(src, markdown.RenderOptions{})
	if !strings.Contains(page.HTML, "lexical-root") {
		t.Fatal("expected lexical editor document")
	}
	if !strings.Contains(page.HTML, "Hello") {
		t.Fatal("expected rendered title")
	}

	md, err := HTMLToMarkdown(`<h1>Hello</h1><ul class="task-list"><li class="task-item"><input type="checkbox"/> Task one</li></ul><p><strong>Bold</strong> text</p>`)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(md, "Hello") || !strings.Contains(md, "Task one") {
		t.Fatalf("unexpected markdown: %q", md)
	}
}
