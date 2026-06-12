package vault

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/osarogie/mindbase/internal/vaultgit"
)

const (
	MetaDir      = ".mindbase"
	legacyMetaDir = ".ubase"
	ConfigFile   = "config.json"
	NotesDir     = "notes"
	DatabasesDir = "databases"
)

type Config struct {
	Name    string `json:"name"`
	Version int    `json:"version"`
}

type Vault struct {
	Root string
}

func Open(root string) (*Vault, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}

	v := &Vault{Root: abs}
	if err := v.migrateLegacyMeta(); err != nil {
		return nil, err
	}
	if err := v.ensureLayout(); err != nil {
		return nil, err
	}
	_ = vaultgit.Ensure(abs)
	return v, nil
}

func (v *Vault) migrateLegacyMeta() error {
	oldPath := filepath.Join(v.Root, legacyMetaDir)
	newPath := filepath.Join(v.Root, MetaDir)
	if _, err := os.Stat(newPath); err == nil {
		return nil
	}
	if _, err := os.Stat(oldPath); os.IsNotExist(err) {
		return nil
	}
	return os.Rename(oldPath, newPath)
}

func (v *Vault) ensureLayout() error {
	dirs := []string{
		filepath.Join(v.Root, NotesDir),
		filepath.Join(v.Root, DatabasesDir),
		filepath.Join(v.Root, MetaDir),
	}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("create %s: %w", dir, err)
		}
	}

	cfgPath := v.ConfigPath()
	if _, err := os.Stat(cfgPath); os.IsNotExist(err) {
		cfg := Config{Name: filepath.Base(v.Root), Version: 1}
		data, err := json.MarshalIndent(cfg, "", "  ")
		if err != nil {
			return err
		}
		if err := os.WriteFile(cfgPath, data, 0o644); err != nil {
			return err
		}
	}
	return nil
}

func (v *Vault) ConfigPath() string {
	return filepath.Join(v.Root, MetaDir, ConfigFile)
}

func (v *Vault) NotesRoot() string {
	return filepath.Join(v.Root, NotesDir)
}

func (v *Vault) DatabasesRoot() string {
	return filepath.Join(v.Root, DatabasesDir)
}

func (v *Vault) AttachmentDir(noteRelPath string) string {
	base := noteRelPath
	if ext := filepath.Ext(base); ext != "" {
		base = base[:len(base)-len(ext)]
	}
	return base + ".attachments"
}

func (v *Vault) ResolveNotePath(rel string) (string, error) {
	clean := filepath.Clean(rel)
	if clean == "." || clean == ".." || filepath.IsAbs(clean) {
		return "", fmt.Errorf("invalid note path")
	}
	full := filepath.Join(v.NotesRoot(), clean)
	if !isWithin(full, v.NotesRoot()) {
		return "", fmt.Errorf("path escapes notes directory")
	}
	return full, nil
}

func (v *Vault) ResolveDatabasePath(name string) (string, error) {
	clean := filepath.Clean(name)
	if clean == "." || clean == ".." || filepath.IsAbs(clean) {
		return "", fmt.Errorf("invalid database name")
	}
	if filepath.Ext(clean) != ".csv" {
		clean += ".csv"
	}
	full := filepath.Join(v.DatabasesRoot(), clean)
	if !isWithin(full, v.DatabasesRoot()) {
		return "", fmt.Errorf("path escapes databases directory")
	}
	return full, nil
}

func isWithin(path, root string) bool {
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return false
	}
	rel = filepath.ToSlash(rel)
	return rel != ".." && !strings.HasPrefix(rel, "../") && !filepath.IsAbs(rel)
}
