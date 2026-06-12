package markdown

import (
	"path/filepath"
	"regexp"
	"strings"
)

var (
	h1TitleRe        = regexp.MustCompile(`(?m)^#\s+(.+?)\s*$`)
	anyHeadingRe     = regexp.MustCompile(`(?m)^#{1,6}\s+(.+?)\s*$`)
	frontmatterTitle = regexp.MustCompile(`(?m)^title:\s*["']?([^"'\n]+?)["']?\s*$`)
)

// TitleFromContent returns the best display title from note content, or fallback.
func TitleFromContent(content, fallback string) string {
	content = strings.TrimPrefix(content, "\uFEFF")

	if title := titleFromFrontmatter(content); title != "" {
		return title
	}
	if m := h1TitleRe.FindStringSubmatch(content); len(m) > 1 {
		if title := strings.TrimSpace(m[1]); title != "" {
			return title
		}
	}
	if m := anyHeadingRe.FindStringSubmatch(content); len(m) > 1 {
		if title := strings.TrimSpace(m[1]); title != "" {
			return title
		}
	}
	if fallback != "" {
		return fallback
	}
	return "Untitled"
}

func titleFromFrontmatter(content string) string {
	if !strings.HasPrefix(content, "---") {
		return ""
	}
	end := strings.Index(content[3:], "\n---")
	if end < 0 {
		return ""
	}
	block := content[3 : 3+end]
	if m := frontmatterTitle.FindStringSubmatch(block); len(m) > 1 {
		return strings.TrimSpace(m[1])
	}
	return ""
}

// TitleFromPath derives a display title from a note or database path.
func TitleFromPath(rel string) string {
	base := filepath.Base(rel)
	base = strings.TrimSuffix(base, filepath.Ext(base))
	if base == "" || base == "." {
		return "Untitled"
	}
	return base
}

// TitleLooksLikePath reports whether title is just the filename fallback for path.
func TitleLooksLikePath(title, relPath string) bool {
	title = strings.TrimSpace(title)
	if title == "" {
		return true
	}
	return strings.EqualFold(title, TitleFromPath(relPath))
}
