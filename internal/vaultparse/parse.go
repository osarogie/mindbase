package vaultparse

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/osarogie/mindbase/internal/markdown"
	"github.com/osarogie/mindbase/internal/vault"
)

var (
	tagRe      = regexp.MustCompile(`(?:^|[\s(])#([a-zA-Z][\w/-]*)`)
	mentionRe  = regexp.MustCompile(`(?:^|[\s(])@([a-zA-Z][\w/-]*)`)
	taskRe     = regexp.MustCompile(`(?m)^[\t ]*[-*+][\t ]+\[([ xX])\][\t ]+(.+)$`)
	wikiLinkRe = regexp.MustCompile(`\[\[(?:page:|note:)?([^\]|]+)(?:\|[^\]]+)?\]\]`)
	scheduleRe = regexp.MustCompile(`(?i)>(today|tomorrow|yesterday|\d{4}-\d{2}-\d{2}|[a-z]+day)`)
)

type Task struct {
	Path     string `json:"path"`
	Line     int    `json:"line"`
	Text     string `json:"text"`
	Done     bool   `json:"done"`
	Schedule string `json:"schedule,omitempty"`
	Tags     []string `json:"tags,omitempty"`
}

type Backlink struct {
	Path    string `json:"path"`
	Title   string `json:"title"`
	Context string `json:"context"`
}

type TagCount struct {
	Tag   string `json:"tag"`
	Count int    `json:"count"`
}

func ExtractTags(content string) []string {
	seen := map[string]bool{}
	var tags []string
	for _, m := range tagRe.FindAllStringSubmatch(content, -1) {
		tag := strings.ToLower(m[1])
		if seen[tag] {
			continue
		}
		seen[tag] = true
		tags = append(tags, tag)
	}
	sort.Strings(tags)
	return tags
}

func ExtractMentions(content string) []string {
	seen := map[string]bool{}
	var mentions []string
	for _, m := range mentionRe.FindAllStringSubmatch(content, -1) {
		name := strings.ToLower(m[1])
		if seen[name] {
			continue
		}
		seen[name] = true
		mentions = append(mentions, name)
	}
	sort.Strings(mentions)
	return mentions
}

func ExtractTasks(path, content string) []Task {
	var tasks []Task
	lines := strings.Split(content, "\n")
	for i, line := range lines {
		m := taskRe.FindStringSubmatch(line)
		if len(m) < 3 {
			continue
		}
		text := strings.TrimSpace(m[2])
		done := strings.ToLower(m[1]) == "x"
		task := Task{
			Path: path,
			Line: i + 1,
			Text: text,
			Done: done,
			Tags: ExtractTags(text),
		}
		if sm := scheduleRe.FindStringSubmatch(text); len(sm) > 1 {
			task.Schedule = normalizeSchedule(sm[1])
			task.Text = strings.TrimSpace(scheduleRe.ReplaceAllString(text, ""))
		}
		tasks = append(tasks, task)
	}
	return tasks
}

func normalizeSchedule(raw string) string {
	raw = strings.ToLower(strings.TrimSpace(raw))
	now := time.Now()
	switch raw {
	case "today":
		return now.Format("2006-01-02")
	case "tomorrow":
		return now.AddDate(0, 0, 1).Format("2006-01-02")
	case "yesterday":
		return now.AddDate(0, 0, -1).Format("2006-01-02")
	default:
		if len(raw) == 10 && raw[4] == '-' {
			return raw
		}
		return raw
	}
}

func FindBacklinks(v *vault.Vault, targetPath string) ([]Backlink, error) {
	targetPath = filepath.ToSlash(targetPath)
	keys := linkKeysForPath(targetPath)
	root := v.NotesRoot()
	var links []Backlink
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if filepath.Ext(path) != ".md" || strings.Contains(path, ".attachments") {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}
		rel = filepath.ToSlash(rel)
		if rel == targetPath {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		content := string(data)
		if !mentionsTarget(content, keys) {
			return nil
		}
		links = append(links, Backlink{
			Path:    rel,
			Title:   markdown.TitleFromContent(content, markdown.TitleFromPath(rel)),
			Context: backlinkContext(content, keys),
		})
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Slice(links, func(i, j int) bool {
		return strings.ToLower(links[i].Title) < strings.ToLower(links[j].Title)
	})
	if links == nil {
		links = []Backlink{}
	}
	return links, nil
}

func ListTags(v *vault.Vault) ([]TagCount, error) {
	counts := map[string]int{}
	root := v.NotesRoot()
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if filepath.Ext(path) != ".md" {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		for _, tag := range ExtractTags(string(data)) {
			counts[tag]++
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	out := make([]TagCount, 0, len(counts))
	for tag, count := range counts {
		out = append(out, TagCount{Tag: tag, Count: count})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count == out[j].Count {
			return out[i].Tag < out[j].Tag
		}
		return out[i].Count > out[j].Count
	})
	return out, nil
}

func ListOpenTasks(v *vault.Vault) ([]Task, error) {
	root := v.NotesRoot()
	var tasks []Task
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if filepath.Ext(path) != ".md" || strings.Contains(path, ".attachments") {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}
		rel = filepath.ToSlash(rel)
		data, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		for _, t := range ExtractTasks(rel, string(data)) {
			if !t.Done {
				tasks = append(tasks, t)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if tasks == nil {
		tasks = []Task{}
	}
	return tasks, nil
}

func linkKeysForPath(path string) map[string]bool {
	path = filepath.ToSlash(path)
	stem := strings.TrimSuffix(filepath.Base(path), ".md")
	keys := map[string]bool{
		strings.ToLower(path): true,
		strings.ToLower(stem): true,
		strings.ToLower(strings.TrimSuffix(path, ".md")): true,
	}
	return keys
}

func mentionsTarget(content string, keys map[string]bool) bool {
	for _, m := range wikiLinkRe.FindAllStringSubmatch(content, -1) {
		if len(m) < 2 {
			continue
		}
		target := strings.ToLower(strings.TrimSpace(m[1]))
		target = strings.TrimPrefix(target, "page:")
		target = strings.TrimPrefix(target, "note:")
		target = strings.TrimSuffix(target, ".md")
		if keys[target] || keys[target+".md"] {
			return true
		}
		base := strings.ToLower(filepath.Base(target))
		if keys[base] {
			return true
		}
	}
	return false
}

func backlinkContext(content string, keys map[string]bool) string {
	for _, line := range strings.Split(content, "\n") {
		if mentionsTarget(line, keys) {
			line = strings.TrimSpace(line)
			if len(line) > 100 {
				return line[:97] + "..."
			}
			return line
		}
	}
	return ""
}
