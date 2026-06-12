package markdown

import (
	"html/template"
	"strings"

	"github.com/osarogie/mindbase/internal/database"
)

func renderDatabaseTableHTML(table *database.Table, caption string) string {
	var b strings.Builder
	b.WriteString(`<div class="database-embed">`)
	if caption != "" {
		b.WriteString("<h4>")
		b.WriteString(template.HTMLEscapeString(caption))
		b.WriteString("</h4>")
	}
	b.WriteString(`<table class="embedded-db"><thead><tr>`)
	for _, h := range table.Headers {
		b.WriteString("<th>")
		b.WriteString(template.HTMLEscapeString(h))
		b.WriteString("</th>")
	}
	b.WriteString("</tr></thead><tbody>")
	for _, row := range table.Rows {
		b.WriteString("<tr>")
		for i := range table.Headers {
			cell := ""
			if i < len(row) {
				cell = row[i]
			}
			b.WriteString("<td>")
			b.WriteString(template.HTMLEscapeString(cell))
			b.WriteString("</td>")
		}
		b.WriteString("</tr>")
	}
	b.WriteString("</tbody></table></div>")
	return b.String()
}

func databaseNameFromTarget(target string) string {
	lower := strings.ToLower(strings.TrimSpace(target))
	for _, prefix := range []string{"db:", "database:"} {
		if strings.HasPrefix(lower, prefix) {
			return strings.TrimSpace(target[len(prefix):])
		}
	}
	return ""
}

// FormatCellLinks renders page/database wiki syntax inside CSV cells for preview.
func FormatCellLinks(cell string, opts RenderOptions) string {
	if !strings.Contains(cell, "[[") {
		return template.HTMLEscapeString(cell)
	}
	var out strings.Builder
	matches := wikiLinkRe.FindAllStringIndex(cell, -1)
	if len(matches) == 0 {
		return template.HTMLEscapeString(cell)
	}
	last := 0
	for _, loc := range matches {
		out.WriteString(template.HTMLEscapeString(cell[last:loc[0]]))
		out.WriteString(renderWikiToken(cell[loc[0]:loc[1]], opts))
		last = loc[1]
	}
	out.WriteString(template.HTMLEscapeString(cell[last:]))
	return out.String()
}

// ExtractPageLinks returns note paths referenced via [[page:…]] or [[…]] in cell values.
func ExtractPageLinks(rows [][]string, headers []string, noteIndex map[string]string) []string {
	seen := map[string]struct{}{}
	var links []string
	pageCol := -1
	for i, h := range headers {
		if strings.EqualFold(strings.TrimSpace(h), "_page") {
			pageCol = i
		}
	}
	for _, row := range rows {
		if pageCol >= 0 && pageCol < len(row) {
			p := strings.TrimSpace(row[pageCol])
			if p != "" {
				if strings.Contains(p, "[[") {
					for _, m := range wikiLinkRe.FindAllString(p, -1) {
						parts := wikiLinkRe.FindStringSubmatch(m)
						if len(parts) >= 2 {
							target := stripPagePrefix(strings.TrimSpace(parts[1]))
							if databaseNameFromTarget(parts[1]) == "" {
								if href := resolveNoteLink(target, noteIndex); href != "" {
									addLink(href, seen, &links)
								}
							}
						}
					}
				} else if href := resolveNoteLink(p, noteIndex); href != "" {
					addLink(href, seen, &links)
				}
			}
		}
		for _, cell := range row {
			for _, m := range wikiLinkRe.FindAllString(cell, -1) {
				parts := wikiLinkRe.FindStringSubmatch(m)
				if len(parts) < 2 {
					continue
				}
				target := stripPagePrefix(strings.TrimSpace(parts[1]))
				if databaseNameFromTarget(parts[1]) != "" {
					continue
				}
				if href := resolveNoteLink(target, noteIndex); href != "" {
					addLink(href, seen, &links)
				}
			}
		}
	}
	return links
}

// PageColumnIndex returns the _page column index or -1.
func PageColumnIndex(headers []string) int {
	for i, h := range headers {
		if strings.EqualFold(strings.TrimSpace(h), "_page") {
			return i
		}
	}
	return -1
}

func PagePathForRow(row []string, pageCol int) string {
	if pageCol < 0 || pageCol >= len(row) {
		return ""
	}
	p := strings.TrimSpace(row[pageCol])
	if strings.Contains(p, "[[") {
		for _, m := range wikiLinkRe.FindAllString(p, -1) {
			parts := wikiLinkRe.FindStringSubmatch(m)
			if len(parts) >= 2 && databaseNameFromTarget(parts[1]) == "" {
				return stripPagePrefix(strings.TrimSpace(parts[1]))
			}
		}
	}
	return p
}

func addLink(href string, seen map[string]struct{}, links *[]string) {
	if _, ok := seen[href]; !ok {
		seen[href] = struct{}{}
		*links = append(*links, href)
	}
}
