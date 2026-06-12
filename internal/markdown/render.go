package markdown

import (
	"bytes"
	"fmt"
	"html/template"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/osarogie/mindbase/internal/database"
)

var (
	wikiLinkRe   = regexp.MustCompile(`\[\[([^\]|]+)(?:\|([^\]]+))?\]\]`)
	mermaidRe    = regexp.MustCompile("(?s)```mermaid\\n(.*?)```")
	excalidrawRe = regexp.MustCompile("(?s)```excalidraw\\n(.*?)```")
	boldRe       = regexp.MustCompile(`\*\*(.+?)\*\*`)
	codeRe       = regexp.MustCompile("`([^`]+)`")
	linkRe       = regexp.MustCompile(`\[([^\]]+)\]\(([^)]+)\)`)
	tagInlineRe  = regexp.MustCompile(`#([a-zA-Z][\w/-]*)`)
	mentionInlineRe = regexp.MustCompile(`@([a-zA-Z][\w/-]*)`)
	scheduleInlineRe = regexp.MustCompile(`(?i)>(today|tomorrow|yesterday|\d{4}-\d{2}-\d{2})`)
	taskLineRe   = regexp.MustCompile(`^[-*+]\s+\[([ xX])\]\s+(.+)$`)
)

type RenderOptions struct {
	NotePath     string
	NoteIndex    map[string]string
	LoadDatabase func(name string) (*database.Table, error)
}

func Render(content string, opts RenderOptions) template.HTML {
	content = renderMermaidBlocks(content)
	content = renderExcalidrawBlocks(content)
	content = renderBasicMarkdown(content, opts)
	return template.HTML(content)
}

func renderWikiToken(match string, opts RenderOptions) string {
	parts := wikiLinkRe.FindStringSubmatch(match)
	if len(parts) < 2 {
		return match
	}
	target := strings.TrimSpace(parts[1])
	label := target
	if len(parts) > 2 && parts[2] != "" {
		label = strings.TrimSpace(parts[2])
	}

	if name := databaseNameFromTarget(target); name != "" && opts.LoadDatabase != nil {
		table, err := opts.LoadDatabase(name)
		if err != nil {
			return fmt.Sprintf(`<div class="database-embed missing"><em>Database not found: %s</em></div>`, template.HTMLEscapeString(name))
		}
		return renderDatabaseTableHTML(table, label)
	}

	target = stripPagePrefix(target)
	href := resolveNoteLink(target, opts.NoteIndex)
	if href == "" {
		return fmt.Sprintf(`<a href="#" class="wiki-link missing" title="Create note">%s</a>`, template.HTMLEscapeString(label))
	}
	return fmt.Sprintf(`<a href="/notes/%s" class="wiki-link page-link" hx-get="/notes/%s" hx-target="#main" hx-push-url="true">%s</a>`,
		template.HTMLEscapeString(href),
		template.HTMLEscapeString(href),
		template.HTMLEscapeString(label),
	)
}

func stripPagePrefix(target string) string {
	for _, p := range []string{"page:", "note:"} {
		if strings.HasPrefix(strings.ToLower(target), p) {
			return strings.TrimSpace(target[len(p):])
		}
	}
	return target
}

func BuildNoteIndex(paths []string) map[string]string {
	index := make(map[string]string, len(paths)*2)
	for _, p := range paths {
		slash := filepath.ToSlash(p)
		index[strings.ToLower(slash)] = slash
		stem := strings.ToLower(strings.TrimSuffix(filepath.Base(p), ".md"))
		index[stem] = slash
		dirStem := strings.ToLower(strings.TrimSuffix(slash, filepath.Ext(slash)))
		index[dirStem] = slash
	}
	return index
}

func renderMermaidBlocks(content string) string {
	return mermaidRe.ReplaceAllStringFunc(content, func(match string) string {
		parts := mermaidRe.FindStringSubmatch(match)
		if len(parts) < 2 {
			return match
		}
		code := template.HTMLEscapeString(strings.TrimSpace(parts[1]))
		return fmt.Sprintf(`<div class="mermaid-block"><pre class="mermaid">%s</pre></div>`, code)
	})
}

func renderExcalidrawBlocks(content string) string {
	return excalidrawRe.ReplaceAllStringFunc(content, func(match string) string {
		parts := excalidrawRe.FindStringSubmatch(match)
		if len(parts) < 2 {
			return match
		}
		raw := template.HTMLEscapeString(strings.TrimSpace(parts[1]))
		return fmt.Sprintf(`<div class="excalidraw-embed" data-excalidraw="%s"></div>`, raw)
	})
}

func renderBasicMarkdown(content string, opts RenderOptions) string {
	var buf bytes.Buffer
	lines := strings.Split(content, "\n")
	inCode := false
	inList := false
	inTable := false

	closeList := func() {
		if inList {
			buf.WriteString("</ul>\n")
			inList = false
		}
	}
	closeTable := func() {
		if inTable {
			buf.WriteString("</tbody></table>\n")
			inTable = false
		}
	}

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if strings.HasPrefix(trimmed, "<div class=\"mermaid-block\">") || strings.HasPrefix(trimmed, "<div class=\"excalidraw-embed\"") {
			closeList()
			closeTable()
			buf.WriteString(trimmed + "\n")
			continue
		}

		if strings.HasPrefix(trimmed, "```") {
			closeList()
			closeTable()
			if !inCode {
				lang := strings.TrimPrefix(trimmed, "```")
				if lang == "mermaid" || lang == "excalidraw" {
					inCode = true
					continue
				}
				buf.WriteString(fmt.Sprintf(`<pre><code class="language-%s">`, template.HTMLEscapeString(lang)))
				inCode = true
			} else {
				buf.WriteString("</code></pre>\n")
				inCode = false
			}
			continue
		}
		if inCode {
			buf.WriteString(template.HTMLEscapeString(line))
			buf.WriteByte('\n')
			continue
		}

		switch {
		case strings.HasPrefix(trimmed, "# "):
			closeList()
			closeTable()
			buf.WriteString("<h1>" + inline(trimmed[2:], opts) + "</h1>\n")
		case strings.HasPrefix(trimmed, "## "):
			closeList()
			closeTable()
			buf.WriteString("<h2>" + inline(trimmed[3:], opts) + "</h2>\n")
		case strings.HasPrefix(trimmed, "### "):
			closeList()
			closeTable()
			buf.WriteString("<h3>" + inline(trimmed[4:], opts) + "</h3>\n")
		case strings.HasPrefix(trimmed, "- "):
			closeTable()
			if m := taskLineRe.FindStringSubmatch(trimmed); len(m) >= 3 {
				done := strings.ToLower(m[1]) == "x"
				cls := ""
				checked := ""
				if done {
					cls = " done"
					checked = " checked"
				}
				if !inList {
					buf.WriteString(`<ul class="task-list">` + "\n")
					inList = true
				}
				buf.WriteString(fmt.Sprintf(`<li class="task-item%s"><input type="checkbox" disabled%s/> %s</li>`+"\n", cls, checked, inline(m[2], opts)))
				continue
			}
			if !inList {
				buf.WriteString("<ul>\n")
				inList = true
			}
			buf.WriteString("<li>" + inline(trimmed[2:], opts) + "</li>\n")
		case strings.Contains(trimmed, "|") && strings.Count(trimmed, "|") >= 2:
			closeList()
			cells := splitTableRow(trimmed)
			if !inTable {
				buf.WriteString("<table><tbody>\n")
				inTable = true
			}
			if isTableSeparator(trimmed) {
				continue
			}
			buf.WriteString("<tr>")
			for _, c := range cells {
				buf.WriteString("<td>" + inline(strings.TrimSpace(c), opts) + "</td>")
			}
			buf.WriteString("</tr>\n")
		case wikiLinkRe.MatchString(trimmed) && strings.HasPrefix(trimmed, "[[") && strings.HasSuffix(trimmed, "]]"):
			closeList()
			closeTable()
			buf.WriteString(renderWikiToken(trimmed, opts))
			buf.WriteByte('\n')
		case trimmed == "":
			closeList()
			closeTable()
			buf.WriteString("<br/>\n")
		default:
			closeList()
			closeTable()
			buf.WriteString("<p>" + inline(trimmed, opts) + "</p>\n")
		}
	}
	closeList()
	closeTable()
	return buf.String()
}

func inline(s string, opts RenderOptions) string {
	var buf strings.Builder
	matches := wikiLinkRe.FindAllStringIndex(s, -1)
	if len(matches) == 0 {
		return formatText(template.HTMLEscapeString(s))
	}
	last := 0
	for _, loc := range matches {
		buf.WriteString(formatText(template.HTMLEscapeString(s[last:loc[0]])))
		buf.WriteString(renderWikiToken(s[loc[0]:loc[1]], opts))
		last = loc[1]
	}
	buf.WriteString(formatText(template.HTMLEscapeString(s[last:])))
	return buf.String()
}

func resolveNoteLink(target string, index map[string]string) string {
	if index == nil {
		return ""
	}
	key := strings.ToLower(strings.TrimSpace(target))
	if p, ok := index[key]; ok {
		return p
	}
	key = strings.ToLower(strings.TrimSuffix(target, ".md"))
	if p, ok := index[key]; ok {
		return p
	}
	stem := strings.ToLower(filepath.Base(target))
	if p, ok := index[stem]; ok {
		return p
	}
	return ""
}

func formatText(s string) string {
	s = tagInlineRe.ReplaceAllStringFunc(s, func(m string) string {
		parts := tagInlineRe.FindStringSubmatch(m)
		if len(parts) < 2 {
			return m
		}
		tag := template.HTMLEscapeString(parts[1])
		return fmt.Sprintf(`<a href="/tags/%s" class="tag-link" hx-get="/tags/%s" hx-target="#main" hx-push-url="true">#%s</a>`, tag, tag, tag)
	})
	s = mentionInlineRe.ReplaceAllStringFunc(s, func(m string) string {
		parts := mentionInlineRe.FindStringSubmatch(m)
		if len(parts) < 2 {
			return m
		}
		name := template.HTMLEscapeString(parts[1])
		return fmt.Sprintf(`<span class="mention">@%s</span>`, name)
	})
	s = scheduleInlineRe.ReplaceAllStringFunc(s, func(m string) string {
		parts := scheduleInlineRe.FindStringSubmatch(m)
		if len(parts) < 2 {
			return m
		}
		val := template.HTMLEscapeString(parts[1])
		return fmt.Sprintf(`<span class="schedule-badge">&gt;%s</span>`, val)
	})
	s = boldRe.ReplaceAllString(s, `<strong>$1</strong>`)
	s = codeRe.ReplaceAllString(s, `<code>$1</code>`)
	s = linkRe.ReplaceAllStringFunc(s, func(m string) string {
		parts := linkRe.FindStringSubmatch(m)
		if len(parts) < 3 {
			return m
		}
		href := parts[2]
		if strings.HasSuffix(strings.ToLower(href), ".excalidraw") {
			return fmt.Sprintf(`<a href="#" class="excalidraw-file-link" data-file="%s">%s</a>`, template.HTMLEscapeString(href), parts[1])
		}
		return fmt.Sprintf(`<a href="%s">%s</a>`, template.HTMLEscapeString(href), parts[1])
	})
	return s
}

func splitTableRow(row string) []string {
	row = strings.Trim(row, "|")
	return strings.Split(row, "|")
}

func isTableSeparator(row string) bool {
	row = strings.ReplaceAll(row, "|", "")
	row = strings.ReplaceAll(row, "-", "")
	row = strings.ReplaceAll(row, ":", "")
	return strings.TrimSpace(row) == ""
}
