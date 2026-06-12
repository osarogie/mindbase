package excalidraw

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/osarogie/mindbase/internal/vault"
)

type Service struct {
	vault *vault.Vault
}

func NewService(v *vault.Vault) *Service {
	return &Service{vault: v}
}

func (s *Service) Load(notePath, filename string) (json.RawMessage, error) {
	if filename == "" {
		return nil, fmt.Errorf("filename required")
	}

	// Attachment path: note.attachments/diagram.excalidraw
	if !strings.HasSuffix(strings.ToLower(filename), ".excalidraw") {
		filename += ".excalidraw"
	}
	attachDir := s.vault.AttachmentDir(notePath)
	full, err := s.vault.ResolveNotePath(filepath.Join(attachDir, filename))
	if err == nil {
		if data, err := os.ReadFile(full); err == nil {
			return validate(data)
		}
	}

	// Co-located: same folder as note
	noteDir := filepath.Dir(notePath)
	full2, err := s.vault.ResolveNotePath(filepath.Join(noteDir, filename))
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(full2)
	if err != nil {
		return nil, err
	}
	return validate(data)
}

func (s *Service) ListForNote(notePath string) ([]string, error) {
	var names []string
	attachDir, err := s.vault.ResolveNotePath(s.vault.AttachmentDir(notePath))
	if err == nil {
		entries, _ := os.ReadDir(attachDir)
		for _, e := range entries {
			if !e.IsDir() && strings.HasSuffix(strings.ToLower(e.Name()), ".excalidraw") {
				names = append(names, e.Name())
			}
		}
	}
	noteDir, err := s.vault.ResolveNotePath(filepath.Dir(notePath))
	if err == nil {
		entries, _ := os.ReadDir(noteDir)
		for _, e := range entries {
			if !e.IsDir() && strings.HasSuffix(strings.ToLower(e.Name()), ".excalidraw") {
				names = append(names, e.Name())
			}
		}
	}
	return names, nil
}

func validate(data []byte) (json.RawMessage, error) {
	var v map[string]any
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, fmt.Errorf("invalid excalidraw json: %w", err)
	}
	return json.RawMessage(data), nil
}
