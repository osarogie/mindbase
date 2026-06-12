package notion

import (
	"strings"
	"time"
)

type ImportResult struct {
	Imported int      `json:"imported"`
	Skipped  int      `json:"skipped"`
	Paths    []string `json:"paths"`
	Errors   []string `json:"errors,omitempty"`
}

func buildNote(title string, page Page, body string) string {
	var b strings.Builder
	b.WriteString("---\n")
	b.WriteString("source: notion\n")
	b.WriteString("notion_id: ")
	b.WriteString(page.ID)
	b.WriteString("\n")
	b.WriteString("notion_url: ")
	b.WriteString(page.URL)
	b.WriteString("\n")
	b.WriteString("imported_at: ")
	b.WriteString(time.Now().UTC().Format(time.RFC3339))
	b.WriteString("\n---\n\n")
	b.WriteString("# ")
	b.WriteString(title)
	b.WriteString("\n\n")
	if strings.TrimSpace(body) == "" {
		b.WriteString("_Cached from Notion — no block content._\n")
	} else {
		b.WriteString(body)
	}
	return b.String()
}
