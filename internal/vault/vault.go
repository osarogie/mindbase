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
	// NotesDir and DatabasesDir are legacy top-level folders. The vault is now
	// a single flat content root: notes (.md) and databases (.csv) live
	// anywhere under Root. These names are kept only so existing vaults can be
	// migrated up to the root (see migrateLegacyLayout).
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
	if err := v.migrateLegacyLayout(); err != nil {
		return nil, err
	}
	if err := v.ensureLayout(); err != nil {
		return nil, err
	}
	_ = vaultgit.Ensure(abs)
	return v, nil
}

// migrateLegacyLayout flattens the old notes/ and databases/ subfolders up into
// the vault root (one-time, idempotent). Files keep their relative subpaths
// (notes/a/b.md -> a/b.md); a name already present at the destination is left
// untouched rather than overwritten, so no content is ever lost. After this the
// vault is a single flat content root.
func (v *Vault) migrateLegacyLayout() error {
	for _, sub := range []string{NotesDir, DatabasesDir} {
		src := filepath.Join(v.Root, sub)
		info, err := os.Stat(src)
		if err != nil || !info.IsDir() {
			continue
		}
		if err := mergeDirUp(src, v.Root); err != nil {
			return fmt.Errorf("migrate %s: %w", sub, err)
		}
		// Remove the source only if it's now empty; a leftover (from a skipped
		// collision) is preserved as an ordinary subfolder.
		_ = os.Remove(src)
	}
	return nil
}

// mergeDirUp moves the contents of src into dst, recursively merging directories
// and never overwriting an existing destination entry.
func mergeDirUp(src, dst string) error {
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, e := range entries {
		from := filepath.Join(src, e.Name())
		to := filepath.Join(dst, e.Name())
		if _, err := os.Stat(to); os.IsNotExist(err) {
			// Nothing in the way — move the whole entry (file or subtree) at once.
			if err := os.Rename(from, to); err != nil {
				return err
			}
			continue
		}
		if e.IsDir() {
			// Merge only when the destination is also a directory. If a file
			// occupies that name, it's a type collision — leave the source
			// subtree in place rather than erroring out (and aborting open).
			if info, err := os.Stat(to); err == nil && info.IsDir() {
				if err := mergeDirUp(from, to); err != nil {
					return err
				}
				_ = os.Remove(from)
			}
		}
		// Destination already occupied (file, or dir colliding with a file):
		// leave the source in place untouched. No content is overwritten.
	}
	return nil
}

// IsSkippableDir reports whether a directory (by base name) should be skipped
// when walking vault content: the meta dir, git, legacy meta, and the
// attachment sidecar folders.
func IsSkippableDir(name string) bool {
	return name == MetaDir || name == legacyMetaDir || name == ".git" ||
		strings.HasSuffix(name, ".attachments")
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
	// Single flat content root: only the meta dir is provisioned; notes and
	// databases live directly under Root.
	if err := os.MkdirAll(filepath.Join(v.Root, MetaDir), 0o755); err != nil {
		return fmt.Errorf("create %s: %w", MetaDir, err)
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

// NotesRoot and DatabasesRoot both resolve to the single content root. They are
// kept as distinct methods so callers stay readable, but notes and databases
// now share one flat tree and are distinguished by file extension.
func (v *Vault) NotesRoot() string {
	return v.Root
}

func (v *Vault) DatabasesRoot() string {
	return v.Root
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
	if clean == "." || clean == ".." || filepath.IsAbs(clean) || isReservedPath(clean) {
		return "", fmt.Errorf("invalid note path")
	}
	full := filepath.Join(v.NotesRoot(), clean)
	if !isWithin(full, v.NotesRoot()) {
		return "", fmt.Errorf("path escapes vault")
	}
	return full, nil
}

func (v *Vault) ResolveDatabasePath(name string) (string, error) {
	clean := filepath.Clean(name)
	if clean == "." || clean == ".." || filepath.IsAbs(clean) || isReservedPath(clean) {
		return "", fmt.Errorf("invalid database name")
	}
	if filepath.Ext(clean) != ".csv" {
		clean += ".csv"
	}
	full := filepath.Join(v.DatabasesRoot(), clean)
	if !isWithin(full, v.DatabasesRoot()) {
		return "", fmt.Errorf("path escapes vault")
	}
	return full, nil
}

// isReservedPath reports whether a cleaned, vault-relative path points into a
// reserved top-level directory (meta, legacy meta, or git). With a single flat
// content root these would otherwise be reachable as "notes"/"databases".
func isReservedPath(clean string) bool {
	first := clean
	if i := strings.IndexAny(clean, `/\`); i >= 0 {
		first = clean[:i]
	}
	return first == MetaDir || first == legacyMetaDir || first == ".git"
}

func isWithin(path, root string) bool {
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return false
	}
	rel = filepath.ToSlash(rel)
	return rel != ".." && !strings.HasPrefix(rel, "../") && !filepath.IsAbs(rel)
}
