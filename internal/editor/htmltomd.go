package editor

import (
	"regexp"
	"strings"

	htmltomarkdown "github.com/JohannesKaufmann/html-to-markdown/v2"
)

var (
	taskItemRe = regexp.MustCompile(`(?is)<li[^>]*class="[^"]*task-item[^"]*"[^>]*>\s*<input[^>]*?(?:checked[^>]*?)?/>\s*(.*?)</li>`)
	wikiLinkRe = regexp.MustCompile(`(?is)<a[^>]*class="[^"]*wiki-link[^"]*"[^>]*href="([^"]*)"[^>]*>(.*?)</a>`)
	tagLinkRe  = regexp.MustCompile(`(?is)<a[^>]*class="[^"]*tag-link[^"]*"[^>]*>#?([^<]+)</a>`)
	mentionRe  = regexp.MustCompile(`(?is)<span[^>]*class="[^"]*mention[^"]*"[^>]*>@([^<]+)</span>`)
	scheduleRe = regexp.MustCompile(`(?is)<span[^>]*class="[^"]*schedule-badge[^"]*"[^>]*>&gt;([^<]+)</span>`)
	brBlockRe  = regexp.MustCompile(`(?m)^<br\s*/>\s*$`)
)

type mdToken struct {
	key   string
	value string
}

// HTMLToMarkdown serializes WYSIWYG HTML back to vault markdown.
func HTMLToMarkdown(html string) (string, error) {
	html = strings.TrimSpace(html)
	if html == "" {
		return "", nil
	}

	tokens := make([]mdToken, 0, 8)
	push := func(value string) string {
		key := "MBTOK" + strings.Repeat("_", len(tokens)+1)
		tokens = append(tokens, mdToken{key: key, value: value})
		return key
	}

	html = extractTasks(html, push)
	html = extractWikiLinks(html, push)
	html = extractTags(html, push)
	html = extractMentions(html, push)
	html = extractSchedules(html, push)

	out, err := htmltomarkdown.ConvertString(html)
	if err != nil {
		return "", err
	}

	for _, t := range tokens {
		out = strings.ReplaceAll(out, t.key, t.value)
	}
	out = strings.TrimSpace(out)
	out = brBlockRe.ReplaceAllString(out, "")
	out = strings.ReplaceAll(out, "\n\n\n", "\n\n")
	return out, nil
}

func extractTasks(html string, push func(string) string) string {
	return taskItemRe.ReplaceAllStringFunc(html, func(match string) string {
		parts := taskItemRe.FindStringSubmatch(match)
		if len(parts) < 2 {
			return match
		}
		checked := " "
		if strings.Contains(strings.ToLower(match), "checked") {
			checked = "x"
		}
		text := strings.TrimSpace(stripTags(parts[1]))
		return "<p>" + push("- ["+checked+"] "+text) + "</p>"
	})
}

func extractWikiLinks(html string, push func(string) string) string {
	return wikiLinkRe.ReplaceAllStringFunc(html, func(match string) string {
		parts := wikiLinkRe.FindStringSubmatch(match)
		if len(parts) < 3 {
			return match
		}
		href := strings.TrimPrefix(parts[1], "/notes/")
		label := strings.TrimSpace(stripTags(parts[2]))
		if label == "" {
			label = href
		}
		token := "[[" + href + "|" + label + "]]"
		if label == href {
			token = "[[" + href + "]]"
		}
		return push(token)
	})
}

func extractTags(html string, push func(string) string) string {
	return tagLinkRe.ReplaceAllStringFunc(html, func(match string) string {
		parts := tagLinkRe.FindStringSubmatch(match)
		if len(parts) < 2 {
			return match
		}
		return push("#" + strings.TrimSpace(parts[1]))
	})
}

func extractMentions(html string, push func(string) string) string {
	return mentionRe.ReplaceAllStringFunc(html, func(match string) string {
		parts := mentionRe.FindStringSubmatch(match)
		if len(parts) < 2 {
			return match
		}
		return push("@" + strings.TrimSpace(parts[1]))
	})
}

func extractSchedules(html string, push func(string) string) string {
	return scheduleRe.ReplaceAllStringFunc(html, func(match string) string {
		parts := scheduleRe.FindStringSubmatch(match)
		if len(parts) < 2 {
			return match
		}
		return push(">" + strings.TrimSpace(parts[1]))
	})
}

func stripTags(s string) string {
	s = regexp.MustCompile(`<[^>]+>`).ReplaceAllString(s, "")
	s = strings.ReplaceAll(s, "&nbsp;", " ")
	return strings.TrimSpace(s)
}
