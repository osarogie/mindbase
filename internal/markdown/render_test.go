package markdown

import (
	"strings"
	"testing"

	"github.com/osarogie/mindbase/internal/database"
)

func TestRenderMermaidBlockNotBrokenByMarkdownPass(t *testing.T) {
	content := "# Projects\n\n```mermaid\ngraph TD\n  A[Notes] --> B[CSV Database]\n  B --> C[Sync API]\n```\n"
	html := string(Render(content, RenderOptions{}))
	if strings.Contains(html, `<p>A[Notes]`) {
		t.Fatalf("mermaid source leaked into paragraph tags: %q", html)
	}
	if !strings.Contains(html, `<pre class="mermaid">graph TD`) {
		t.Fatalf("expected intact mermaid pre block, got: %q", html)
	}
	if !strings.Contains(html, `--&gt; B[CSV Database]`) {
		t.Fatalf("expected escaped arrow in mermaid block, got: %q", html)
	}
}

func TestRenderDatabaseEmbedLinksWikiCells(t *testing.T) {
	table := &database.Table{
		Headers: []string{"id", "_page"},
		Rows:    [][]string{{"1", "[[page:welcome]]"}},
	}
	opts := RenderOptions{NoteIndex: map[string]string{"welcome": "welcome.md"}}
	html := renderDatabaseTableHTML(table, "db:projects", opts)
	if !strings.Contains(html, `class="wiki-link page-link"`) {
		t.Fatalf("expected wiki link in table cell, got: %q", html)
	}
}
