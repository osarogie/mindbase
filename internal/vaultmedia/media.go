package vaultmedia

import (
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/osarogie/mindbase/internal/vault"
)

// Kind classifies a vault file for viewers.
type Kind string

const (
	KindImage Kind = "image"
	KindPDF   Kind = "pdf"
	KindEPUB  Kind = "epub"
	KindCSV   Kind = "csv"
)

type Entry struct {
	Path     string
	Kind     Kind
	Title    string
	Folder   string
	FilePath string
	Modified time.Time
	Size     int64
}

var extKinds = map[string]Kind{
	".png": KindImage, ".jpg": KindImage, ".jpeg": KindImage,
	".gif": KindImage, ".webp": KindImage, ".heic": KindImage, ".heif": KindImage,
	".svg": KindImage,
	".pdf":  KindPDF,
	".epub": KindEPUB,
	".csv":  KindCSV,
}

func KindForExt(ext string) (Kind, bool) {
	k, ok := extKinds[strings.ToLower(ext)]
	return k, ok
}

// List scans the notes tree for readable media files.
func List(v *vault.Vault) ([]Entry, error) {
	root := v.NotesRoot()
	var out []Entry
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
		ext := strings.ToLower(filepath.Ext(path))
		kind, ok := KindForExt(ext)
		if !ok || ext == ".md" {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}
		rel = filepath.ToSlash(rel)
		info, err := d.Info()
		if err != nil {
			return nil
		}
		folder := filepath.Dir(rel)
		if folder == "." {
			folder = ""
		}
		base := filepath.Base(rel)
		title := strings.TrimSuffix(base, ext)
		out = append(out, Entry{
			Path:     rel,
			Kind:     kind,
			Title:    title,
			Folder:   folder,
			FilePath: path,
			Modified: info.ModTime(),
			Size:     info.Size(),
		})
		return nil
	})
	if err != nil {
		return nil, err
	}
	if out == nil {
		out = []Entry{}
	}
	return out, nil
}

func Subtitle(kind Kind, size int64) string {
	switch kind {
	case KindImage:
		return "Image"
	case KindPDF:
		return "PDF"
	case KindEPUB:
		return "EPUB"
	case KindCSV:
		return "CSV"
	default:
		return "File"
	}
}
