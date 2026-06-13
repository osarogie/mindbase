package cache

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"github.com/osarogie/mindbase/internal/vault"
)

const IndexFile = "index.json"

type Index struct {
	Version int         `json:"version"`
	Updated time.Time   `json:"updated,omitempty"`
	Notion  NotionIndex `json:"notion"`
	GDrive  GDriveIndex `json:"gdrive"`
}

type NotionIndex struct {
	LastSync time.Time                 `json:"last_sync,omitempty"`
	Pages    map[string]NotionPageEntry `json:"pages"`
}

type NotionPageEntry struct {
	Path     string    `json:"path"`
	Title    string    `json:"title"`
	Modified time.Time `json:"modified"`
	CachedAt time.Time `json:"cached_at"`
	URL      string    `json:"url"`
}

type GDriveIndex struct {
	FolderID string                    `json:"folder_id,omitempty"`
	LastSync time.Time                 `json:"last_sync,omitempty"`
	Files    map[string]GDriveFileEntry `json:"files"`
}

type GDriveFileEntry struct {
	DriveID      string    `json:"drive_id"`
	RemoteMod    time.Time `json:"remote_mod,omitempty"`
	LocalMod     time.Time `json:"local_mod"`
	LastSyncedAt time.Time `json:"last_synced_at"`
}

type Store struct {
	root string
}

func New(v *vault.Vault) *Store {
	return &Store{root: filepath.Join(v.Root, vault.MetaDir, "cache")}
}

func (s *Store) Path() string { return s.root }

func (s *Store) Load() (Index, error) {
	if err := os.MkdirAll(s.root, 0o755); err != nil {
		return Index{}, err
	}
	path := filepath.Join(s.root, IndexFile)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return emptyIndex(), nil
		}
		return Index{}, err
	}
	var idx Index
	if err := json.Unmarshal(data, &idx); err != nil {
		return emptyIndex(), err
	}
	if idx.Notion.Pages == nil {
		idx.Notion.Pages = map[string]NotionPageEntry{}
	}
	if idx.GDrive.Files == nil {
		idx.GDrive.Files = map[string]GDriveFileEntry{}
	}
	if idx.Version == 0 {
		idx.Version = 1
	}
	return idx, nil
}

func (s *Store) Save(idx Index) error {
	if err := os.MkdirAll(s.root, 0o755); err != nil {
		return err
	}
	idx.Updated = time.Now().UTC()
	if idx.Notion.Pages == nil {
		idx.Notion.Pages = map[string]NotionPageEntry{}
	}
	if idx.GDrive.Files == nil {
		idx.GDrive.Files = map[string]GDriveFileEntry{}
	}
	data, err := json.MarshalIndent(idx, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.root, IndexFile), data, 0o644)
}

// ResetNotion clears the cached Notion page index so the next sync re-imports
// every page from scratch (e.g. to backfill pages imported before a fix). The
// GDrive index is left intact. Returns the number of page entries cleared.
func (s *Store) ResetNotion() (int, error) {
	// Load returns a usable (empty) index even on a corrupt/unreadable file, so
	// proceed regardless — clearing is exactly the recovery for a bad index. The
	// GDrive half of whatever Load returned is preserved.
	idx, _ := s.Load()
	n := len(idx.Notion.Pages)
	idx.Notion.Pages = map[string]NotionPageEntry{}
	idx.Notion.LastSync = time.Time{}
	if err := s.Save(idx); err != nil {
		return 0, err
	}
	return n, nil
}

func emptyIndex() Index {
	return Index{
		Version: 1,
		Notion: NotionIndex{
			Pages: map[string]NotionPageEntry{},
		},
		GDrive: GDriveIndex{
			Files: map[string]GDriveFileEntry{},
		},
	}
}

func (s *Store) Stats(idx Index) map[string]any {
	return map[string]any{
		"notion_pages": len(idx.Notion.Pages),
		"gdrive_files": len(idx.GDrive.Files),
		"last_notion_sync": idx.Notion.LastSync,
		"last_gdrive_sync": idx.GDrive.LastSync,
		"updated":          idx.Updated,
	}
}
