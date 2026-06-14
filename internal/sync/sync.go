package sync

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/osarogie/mindbase/internal/vault"
)

type Change struct {
	Path     string    `json:"path"`
	Type     string    `json:"type"`
	Modified time.Time `json:"modified"`
	ETag     string    `json:"etag"`
	Size     int64     `json:"size"`
}

type FilePayload struct {
	Path    string `json:"path"`
	Type    string `json:"type"`
	Content string `json:"content"`
	ETag    string `json:"etag"`
}

type Service struct {
	vault *vault.Vault
}

func NewService(v *vault.Vault) *Service {
	return &Service{vault: v}
}

func (s *Service) ChangesSince(since time.Time) ([]Change, error) {
	var changes []Change

	// Single flat root: one walk covers notes (.md/.excalidraw) and databases (.csv).
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
		var typ string
		switch filepath.Ext(path) {
		case ".md", ".excalidraw":
			typ = "note"
		case ".csv":
			typ = "database"
		default:
			return nil
		}
		info, err := d.Info()
		if err != nil || !info.ModTime().After(since) {
			return nil
		}
		rel, _ := filepath.Rel(root, path)
		changes = append(changes, fileChange(filepath.ToSlash(rel), typ, info))
		return nil
	})

	return changes, nil
}

func (s *Service) Pull(paths []string) ([]FilePayload, error) {
	var out []FilePayload
	for _, p := range paths {
		payload, err := s.readPath(p)
		if err != nil {
			continue
		}
		out = append(out, *payload)
	}
	return out, nil
}

func (s *Service) Push(items []FilePayload) ([]Change, error) {
	var changes []Change
	for _, item := range items {
		var full string
		switch item.Type {
		case "database":
			f, err := s.vault.ResolveDatabasePath(item.Path)
			if err != nil {
				continue
			}
			full = f
		default:
			f, err := s.vault.ResolveNotePath(item.Path)
			if err != nil {
				continue
			}
			full = f
		}
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			continue
		}
		if err := os.WriteFile(full, []byte(item.Content), 0o644); err != nil {
			continue
		}
		info, _ := os.Stat(full)
		if info != nil {
			changes = append(changes, fileChange(item.Path, item.Type, info))
		}
	}
	return changes, nil
}

func (s *Service) readPath(rel string) (*FilePayload, error) {
	typ := "note"
	var full string
	var err error
	if strings.HasSuffix(rel, ".csv") {
		typ = "database"
		full, err = s.vault.ResolveDatabasePath(strings.TrimSuffix(rel, ".csv"))
	} else {
		full, err = s.vault.ResolveNotePath(rel)
	}
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(full)
	if err != nil {
		return nil, err
	}
	info, _ := os.Stat(full)
	etag := ""
	if info != nil {
		etag = etagFor(info, data)
	}
	return &FilePayload{
		Path:    rel,
		Type:    typ,
		Content: string(data),
		ETag:    etag,
	}, nil
}

func fileChange(path, typ string, info os.FileInfo) Change {
	return Change{
		Path:     path,
		Type:     typ,
		Modified: info.ModTime(),
		Size:     info.Size(),
		ETag:     etagFor(info, nil),
	}
}

func etagFor(info os.FileInfo, data []byte) string {
	h := sha256.New()
	if data != nil {
		h.Write(data)
	} else {
		h.Write([]byte(info.ModTime().UTC().Format(time.RFC3339Nano)))
		io.WriteString(h, "|")
		io.WriteString(h, itoa(info.Size()))
	}
	return hex.EncodeToString(h.Sum(nil))[:16]
}

func itoa(n int64) string {
	b, _ := json.Marshal(n)
	return string(b)
}
