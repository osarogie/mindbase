package database

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/osarogie/mindbase/internal/vault"
	"github.com/osarogie/mindbase/internal/vaultgit"
)

type Entry struct {
	Name     string    `json:"name"`
	Path     string    `json:"path"`
	Modified time.Time `json:"modified"`
	Rows     int       `json:"rows"`
	Columns  int       `json:"columns"`
}

type Table struct {
	Name    string     `json:"name"`
	Path    string     `json:"path"`
	Headers []string   `json:"headers"`
	Rows    [][]string `json:"rows"`
}

type Service struct {
	vault *vault.Vault
}

func NewService(v *vault.Vault) *Service {
	return &Service{vault: v}
}

func (s *Service) List() ([]Entry, error) {
	root := s.vault.DatabasesRoot()
	var result []Entry
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if vault.IsSkippableDir(d.Name()) {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(d.Name(), ".csv") {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		rel = strings.TrimSuffix(filepath.ToSlash(rel), ".csv")
		info, err := d.Info()
		if err != nil {
			return err
		}
		table, err := s.read(path)
		if err != nil {
			return nil
		}
		result = append(result, Entry{
			Name:     rel,
			Path:     filepath.Base(path),
			Modified: info.ModTime(),
			Rows:     len(table.Rows),
			Columns:  len(table.Headers),
		})
		return nil
	})
	if err != nil {
		return nil, err
	}
	if result == nil {
		result = []Entry{}
	}
	return result, nil
}

func (s *Service) Get(name string) (*Table, error) {
	full, err := s.vault.ResolveDatabasePath(name)
	if err != nil {
		return nil, err
	}
	return s.read(full)
}

func (s *Service) Save(name string, headers []string, rows [][]string) (*Table, error) {
	full, err := s.vault.ResolveDatabasePath(name)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return nil, err
	}

	f, err := os.Create(full)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	w := csv.NewWriter(f)
	if err := w.Write(headers); err != nil {
		return nil, err
	}
	for _, row := range rows {
		if err := w.Write(row); err != nil {
			return nil, err
		}
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return nil, err
	}
	_ = vaultgit.Track(s.vault.Root, []string{vaultgit.DatabasePath(name)}, "Update database "+name)
	return s.Get(name)
}

func (s *Service) Delete(name string) error {
	full, err := s.vault.ResolveDatabasePath(name)
	if err != nil {
		return err
	}
	if err := os.Remove(full); err != nil {
		return err
	}
	_ = vaultgit.Track(s.vault.Root, []string{vaultgit.DatabasePath(name)}, "Delete database "+name)
	return nil
}

func (s *Service) Query(name, filterJSON string) (map[string]any, error) {
	table, err := s.Get(name)
	if err != nil {
		return nil, err
	}

	var filter struct {
		Search string `json:"search"`
		Limit  int    `json:"limit"`
	}
	if filterJSON != "" {
		_ = json.Unmarshal([]byte(filterJSON), &filter)
	}

	rows := table.Rows
	if filter.Search != "" {
		search := strings.ToLower(filter.Search)
		var filtered [][]string
		for _, row := range rows {
			for _, cell := range row {
				if strings.Contains(strings.ToLower(cell), search) {
					filtered = append(filtered, row)
					break
				}
			}
		}
		rows = filtered
	}
	if filter.Limit > 0 && len(rows) > filter.Limit {
		rows = rows[:filter.Limit]
	}

	return map[string]any{
		"name":    table.Name,
		"headers": table.Headers,
		"rows":    rows,
		"total":   len(rows),
	}, nil
}

func (s *Service) read(path string) (*Table, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open csv: %w", err)
	}
	defer f.Close()

	r := csv.NewReader(f)
	records, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("parse csv: %w", err)
	}

	rel, _ := filepath.Rel(s.vault.DatabasesRoot(), path)
	relName := strings.TrimSuffix(filepath.ToSlash(rel), ".csv")
	if len(records) == 0 {
		return &Table{Name: relName, Path: filepath.Base(path), Headers: []string{}, Rows: [][]string{}}, nil
	}

	return &Table{
		Name:    relName,
		Path:    filepath.Base(path),
		Headers: records[0],
		Rows:    records[1:],
	}, nil
}
