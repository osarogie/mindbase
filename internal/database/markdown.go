package database

import (
	"fmt"
	"path/filepath"
	"strings"
)

func ToMarkdown(t *Table) string {
	name := t.Name
	if name == "" {
		name = strings.TrimSuffix(filepath.Base(t.Path), ".csv")
	}
	var b strings.Builder
	b.WriteString("# ")
	b.WriteString(name)
	b.WriteString("\n\n")
	if len(t.Headers) == 0 {
		return b.String()
	}
	b.WriteString("| ")
	b.WriteString(strings.Join(escapeCells(t.Headers), " | "))
	b.WriteString(" |\n| ")
	seps := make([]string, len(t.Headers))
	for i := range seps {
		seps[i] = "---"
	}
	b.WriteString(strings.Join(seps, " | "))
	b.WriteString(" |\n")
	for _, row := range t.Rows {
		cells := padRow(row, len(t.Headers))
		b.WriteString("| ")
		b.WriteString(strings.Join(escapeCells(cells), " | "))
		b.WriteString(" |\n")
	}
	return b.String()
}

func FromMarkdown(content, relName string) (*Table, error) {
	lines := strings.Split(content, "\n")
	title := strings.TrimSuffix(filepath.Base(relName), ".csv")
	if title == "" || title == "." {
		title = "database"
	}
	var tableLines []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "# ") && title == strings.TrimSuffix(filepath.Base(relName), ".csv") {
			title = strings.TrimSpace(strings.TrimPrefix(trimmed, "# "))
			continue
		}
		if strings.HasPrefix(trimmed, "|") {
			tableLines = append(tableLines, trimmed)
		}
	}
	if len(tableLines) == 0 {
		return &Table{Name: relName, Path: relName + ".csv", Headers: []string{}, Rows: [][]string{}}, nil
	}
	headers := parseRow(tableLines[0])
	start := 1
	if len(tableLines) > 1 && isSeparatorRow(tableLines[1]) {
		start = 2
	}
	var rows [][]string
	for _, line := range tableLines[start:] {
		if isSeparatorRow(line) {
			continue
		}
		rows = append(rows, padRow(parseRow(line), len(headers)))
	}
	return &Table{
		Name:    relName,
		Path:    relName + ".csv",
		Headers: headers,
		Rows:    rows,
	}, nil
}

func parseRow(line string) []string {
	line = strings.TrimSpace(line)
	line = strings.TrimPrefix(line, "|")
	line = strings.TrimSuffix(line, "|")
	parts := strings.Split(line, "|")
	out := make([]string, len(parts))
	for i, p := range parts {
		out[i] = strings.TrimSpace(strings.ReplaceAll(p, "\\|", "|"))
	}
	return out
}

func isSeparatorRow(line string) bool {
	cells := parseRow(line)
	if len(cells) == 0 {
		return false
	}
	for _, c := range cells {
		c = strings.TrimSpace(c)
		if c == "" {
			continue
		}
		for _, ch := range c {
			if ch != '-' && ch != ':' && ch != ' ' {
				return false
			}
		}
	}
	return true
}

func padRow(row []string, n int) []string {
	if len(row) >= n {
		return row[:n]
	}
	out := append([]string{}, row...)
	for len(out) < n {
		out = append(out, "")
	}
	return out
}

func escapeCells(cells []string) []string {
	out := make([]string, len(cells))
	for i, c := range cells {
		out[i] = strings.ReplaceAll(c, "|", "\\|")
	}
	return out
}

func SaveMarkdown(s *Service, relName, content string) (*Table, error) {
	table, err := FromMarkdown(content, relName)
	if err != nil {
		return nil, err
	}
	if relName == "" {
		return nil, fmt.Errorf("database name required")
	}
	return s.Save(relName, table.Headers, table.Rows)
}

func GetMarkdown(s *Service, relName string) (string, error) {
	table, err := s.Get(relName)
	if err != nil {
		return "", err
	}
	return ToMarkdown(table), nil
}
