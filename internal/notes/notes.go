package notes

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/osarogie/mindbase/internal/snapshots"
	"github.com/osarogie/mindbase/internal/vault"
	"github.com/osarogie/mindbase/internal/vaultgit"
)

type Entry struct {
	Path         string    `json:"path"`
	Title        string    `json:"title"`
	Modified     time.Time `json:"modified"`
	Size         int64     `json:"size"`
	HasAttach    bool      `json:"hasAttachments"`
}

type Note struct {
	Path    string `json:"path"`
	Title   string `json:"title"`
	Content string `json:"content"`
}

type Service struct {
	vault *vault.Vault
}

func NewService(v *vault.Vault) *Service {
	return &Service{vault: v}
}

func (s *Service) List() ([]Entry, error) {
	root := s.vault.NotesRoot()
	var entries []Entry

	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if strings.HasSuffix(d.Name(), ".attachments") {
				return filepath.SkipDir
			}
			return nil
		}
		if filepath.Ext(path) != ".md" {
			return nil
		}

		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		rel = filepath.ToSlash(rel)

		info, err := d.Info()
		if err != nil {
			return err
		}

		attachDir, _ := s.vault.ResolveNotePath(s.vault.AttachmentDir(rel))
		hasAttach := dirExists(attachDir)

		entries = append(entries, Entry{
			Path:      rel,
			Title:     titleFromPath(rel),
			Modified:  info.ModTime(),
			Size:      info.Size(),
			HasAttach: hasAttach,
		})
		return nil
	})
	if err != nil {
		return nil, err
	}
	if entries == nil {
		entries = []Entry{}
	}
	return entries, nil
}

func (s *Service) Get(relPath string) (*Note, error) {
	full, err := s.vault.ResolveNotePath(relPath)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(full)
	if err != nil {
		return nil, fmt.Errorf("read note: %w", err)
	}
	return &Note{
		Path:    filepath.ToSlash(relPath),
		Title:   titleFromPath(relPath),
		Content: string(data),
	}, nil
}

func (s *Service) Save(relPath, content string) (*Note, error) {
	full, err := s.vault.ResolveNotePath(relPath)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return nil, err
	}
	if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
		return nil, fmt.Errorf("write note: %w", err)
	}
	msg := "Update note " + relPath
	_ = vaultgit.Track(s.vault.Root, []string{vaultgit.NotePath(relPath)}, msg)
	_ = snapshots.Record(s.vault.Root, vaultgit.NotePath(relPath), content, msg)
	return s.Get(relPath)
}

func (s *Service) Delete(relPath string) error {
	full, err := s.vault.ResolveNotePath(relPath)
	if err != nil {
		return err
	}
	if err := os.Remove(full); err != nil {
		return fmt.Errorf("delete note: %w", err)
	}

	attachDir, err := s.vault.ResolveNotePath(s.vault.AttachmentDir(relPath))
	if err == nil && dirExists(attachDir) {
		_ = os.RemoveAll(attachDir)
	}
	_ = vaultgit.Track(s.vault.Root, []string{vaultgit.NotePath(relPath)}, "Delete note "+relPath)
	return nil
}

func titleFromPath(rel string) string {
	base := filepath.Base(rel)
	return strings.TrimSuffix(base, filepath.Ext(base))
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}
