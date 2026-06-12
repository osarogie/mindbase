package attachments

import (
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/osarogie/mindbase/internal/vault"
)

type Entry struct {
	Name     string    `json:"name"`
	Path     string    `json:"path"`
	Size     int64     `json:"size"`
	MimeType string    `json:"mimeType"`
	Modified time.Time `json:"modified"`
}

type Service struct {
	vault *vault.Vault
}

func NewService(v *vault.Vault) *Service {
	return &Service{vault: v}
}

func (s *Service) DirForNote(noteRelPath string) (string, error) {
	attachRel := s.vault.AttachmentDir(noteRelPath)
	return s.vault.ResolveNotePath(attachRel)
}

func (s *Service) List(noteRelPath string) ([]Entry, error) {
	dir, err := s.DirForNote(noteRelPath)
	if err != nil {
		return nil, err
	}
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return []Entry{}, nil
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var result []Entry
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		mimeType := mime.TypeByExtension(filepath.Ext(e.Name()))
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}
		result = append(result, Entry{
			Name:     e.Name(),
			Path:     e.Name(),
			Size:     info.Size(),
			MimeType: mimeType,
			Modified: info.ModTime(),
		})
	}
	return result, nil
}

func (s *Service) Save(noteRelPath, filename string, r io.Reader) (*Entry, error) {
	dir, err := s.DirForNote(noteRelPath)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}

	safeName := sanitizeFilename(filename)
	if safeName == "" {
		safeName = uuid.New().String()
	}

	dest := filepath.Join(dir, safeName)
	f, err := os.Create(dest)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	n, err := io.Copy(f, r)
	if err != nil {
		return nil, err
	}

	mimeType := mime.TypeByExtension(filepath.Ext(safeName))
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	info, _ := f.Stat()
	mod := time.Now()
	if info != nil {
		mod = info.ModTime()
	}

	return &Entry{
		Name:     safeName,
		Path:     safeName,
		Size:     n,
		MimeType: mimeType,
		Modified: mod,
	}, nil
}

func (s *Service) Open(noteRelPath, filename string) (string, error) {
	dir, err := s.DirForNote(noteRelPath)
	if err != nil {
		return "", err
	}
	safeName := sanitizeFilename(filename)
	full := filepath.Join(dir, safeName)
	if !strings.HasPrefix(full, dir) {
		return "", fmt.Errorf("invalid attachment path")
	}
	return full, nil
}

func (s *Service) Delete(noteRelPath, filename string) error {
	full, err := s.Open(noteRelPath, filename)
	if err != nil {
		return err
	}
	return os.Remove(full)
}

func sanitizeFilename(name string) string {
	name = filepath.Base(name)
	name = strings.ReplaceAll(name, "..", "")
	return strings.TrimSpace(name)
}
