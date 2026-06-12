package search

import (
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/osarogie/mindbase/internal/markdown"
	"github.com/osarogie/mindbase/internal/vault"
)

type Result struct {
	Path     string    `json:"path"`
	Title    string    `json:"title"`
	Type     string    `json:"type"`
	Snippet  string    `json:"snippet"`
	Score    int       `json:"score"`
	Modified time.Time `json:"modified"`
}

type Service struct {
	vault *vault.Vault
}

func NewService(v *vault.Vault) *Service {
	return &Service{vault: v}
}

func (s *Service) Query(q string) ([]Result, error) {
	q = strings.TrimSpace(strings.ToLower(q))
	if q == "" {
		return []Result{}, nil
	}

	var results []Result
	terms := strings.Fields(q)

	notesRoot := s.vault.NotesRoot()
	_ = filepath.WalkDir(notesRoot, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if filepath.Ext(path) != ".md" {
			return nil
		}
		if r := s.searchFile(path, notesRoot, "note", terms, q); r != nil {
			results = append(results, *r)
		}
		return nil
	})

	dbRoot := s.vault.DatabasesRoot()
	entries, _ := os.ReadDir(dbRoot)
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".csv") {
			continue
		}
		path := filepath.Join(dbRoot, e.Name())
		if r := s.searchFile(path, dbRoot, "database", terms, q); r != nil {
			results = append(results, *r)
		}
	}

	sortResults(results)
	if results == nil {
		results = []Result{}
	}
	return results, nil
}

func (s *Service) searchFile(fullPath, root, typ string, terms []string, q string) *Result {
	data, err := os.ReadFile(fullPath)
	if err != nil {
		return nil
	}
	lower := strings.ToLower(string(data))
	score := 0
	for _, t := range terms {
		score += strings.Count(lower, t) * 10
	}
	if strings.Contains(strings.ToLower(filepath.Base(fullPath)), q) {
		score += 50
	}
	if score == 0 {
		return nil
	}

	info, _ := os.Stat(fullPath)
	rel, _ := filepath.Rel(root, fullPath)
	rel = filepath.ToSlash(rel)

	return &Result{
		Path:     rel,
		Title:    markdown.TitleFromContent(string(data), markdown.TitleFromPath(rel)),
		Type:     typ,
		Snippet:  snippet(string(data), q),
		Score:    score,
		Modified: info.ModTime(),
	}
}

func snippet(content, q string) string {
	lines := strings.Split(content, "\n")
	lowerQ := strings.ToLower(q)
	for _, line := range lines {
		if strings.Contains(strings.ToLower(line), lowerQ) {
			line = strings.TrimSpace(line)
			if len(line) > 120 {
				line = line[:117] + "..."
			}
			return line
		}
	}
	if len(content) > 120 {
		return content[:117] + "..."
	}
	return content
}

func sortResults(results []Result) {
	for i := 0; i < len(results); i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].Score > results[i].Score {
				results[i], results[j] = results[j], results[i]
			}
		}
	}
}
