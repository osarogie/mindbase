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

	// Single flat root: one walk surfaces both notes (.md) and databases (.csv).
	root := s.vault.NotesRoot()
	_ = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			if vault.IsSkippableDir(d.Name()) {
				return filepath.SkipDir
			}
			return nil
		}
		switch filepath.Ext(path) {
		case ".md":
			if r := s.searchFile(path, root, "note", terms, q); r != nil {
				results = append(results, *r)
			}
		case ".csv":
			if r := s.searchFile(path, root, "database", terms, q); r != nil {
				results = append(results, *r)
			}
		}
		return nil
	})

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
