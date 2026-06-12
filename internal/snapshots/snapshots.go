package snapshots

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const maxPerNote = 50

// Entry is one stored note revision (git-free fallback for mobile).
type Entry struct {
	Hash    string `json:"hash"`
	Short   string `json:"short"`
	Date    string `json:"date"`
	Subject string `json:"subject"`
}

type manifestItem struct {
	ID      string `json:"id"`
	Date    string `json:"date"`
	Subject string `json:"subject"`
	Digest  string `json:"digest"`
}

type manifest struct {
	Items []manifestItem `json:"items"`
}

// Record stores a snapshot when content changed since the last one.
func Record(root, noteRelPath, content, subject string) error {
	noteRelPath = normalizeNotePath(noteRelPath)
	if noteRelPath == "" {
		return nil
	}
	digest := digest(content)
	dir, err := noteDir(root, noteRelPath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}

	m, err := readManifest(dir)
	if err != nil {
		return err
	}
	if len(m.Items) > 0 && m.Items[0].Digest == digest {
		return nil
	}

	id := fmt.Sprintf("snap-%d", time.Now().UnixNano())
	item := manifestItem{
		ID:      id,
		Date:    time.Now().UTC().Format(time.RFC3339),
		Subject: subject,
		Digest:  digest,
	}
	m.Items = append([]manifestItem{item}, m.Items...)
	if len(m.Items) > maxPerNote {
		for _, old := range m.Items[maxPerNote:] {
			_ = os.Remove(filepath.Join(dir, old.ID+".md"))
		}
		m.Items = m.Items[:maxPerNote]
	}
	if err := os.WriteFile(filepath.Join(dir, id+".md"), []byte(content), 0o644); err != nil {
		return err
	}
	return writeManifest(dir, m)
}

// Log returns recent snapshots for a note, newest first.
func Log(root, noteRelPath string, limit int) ([]Entry, error) {
	noteRelPath = normalizeNotePath(noteRelPath)
	if noteRelPath == "" {
		return []Entry{}, nil
	}
	if limit <= 0 {
		limit = 30
	}
	dir, err := noteDir(root, noteRelPath)
	if err != nil {
		return nil, err
	}
	m, err := readManifest(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []Entry{}, nil
		}
		return nil, err
	}
	out := make([]Entry, 0, limit)
	for _, item := range m.Items {
		if len(out) >= limit {
			break
		}
		out = append(out, toEntry(item))
	}
	return out, nil
}

// Content returns snapshot body for id (e.g. snap-1704067200000000000).
func Content(root, noteRelPath, id string) (string, error) {
	noteRelPath = normalizeNotePath(noteRelPath)
	id = strings.TrimSpace(id)
	if noteRelPath == "" || id == "" {
		return "", fmt.Errorf("path and id required")
	}
	if !strings.HasPrefix(id, "snap-") {
		return "", fmt.Errorf("invalid snapshot id")
	}
	dir, err := noteDir(root, noteRelPath)
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(filepath.Join(dir, id+".md"))
	if err != nil {
		return "", fmt.Errorf("read snapshot: %w", err)
	}
	return string(data), nil
}

func normalizeNotePath(rel string) string {
	rel = strings.TrimSpace(filepath.ToSlash(rel))
	if rel == "" {
		return ""
	}
	if !strings.HasPrefix(rel, "notes/") {
		rel = "notes/" + strings.TrimPrefix(rel, "/")
	}
	return rel
}

func noteKey(noteRelPath string) string {
	return strings.ReplaceAll(noteRelPath, "/", "__")
}

func noteDir(root, noteRelPath string) (string, error) {
	base := filepath.Join(root, ".mindbase", "snapshots", noteKey(noteRelPath))
	return filepath.Clean(base), nil
}

func digest(content string) string {
	sum := sha256.Sum256([]byte(content))
	return hex.EncodeToString(sum[:8])
}

func toEntry(item manifestItem) Entry {
	short := item.ID
	if len(short) > 11 {
		short = short[len(short)-7:]
	}
	return Entry{
		Hash:    item.ID,
		Short:   short,
		Date:    item.Date,
		Subject: item.Subject,
	}
}

func manifestPath(dir string) string {
	return filepath.Join(dir, "manifest.json")
}

func readManifest(dir string) (manifest, error) {
	data, err := os.ReadFile(manifestPath(dir))
	if err != nil {
		if os.IsNotExist(err) {
			return manifest{Items: []manifestItem{}}, nil
		}
		return manifest{}, err
	}
	var m manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return manifest{}, err
	}
	if m.Items == nil {
		m.Items = []manifestItem{}
	}
	sort.Slice(m.Items, func(i, j int) bool {
		return m.Items[i].Date > m.Items[j].Date
	})
	return m, nil
}

func writeManifest(dir string, m manifest) error {
	sort.Slice(m.Items, func(i, j int) bool {
		return m.Items[i].Date > m.Items[j].Date
	})
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(manifestPath(dir), data, 0o644)
}
