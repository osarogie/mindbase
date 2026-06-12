package gdrive

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"google.golang.org/api/drive/v3"

	"github.com/osarogie/mindbase/internal/connectors/cache"
	"github.com/osarogie/mindbase/internal/vault"
)

// SyncBidirectional pushes local changes to Drive and pulls remote updates into the local cache.
func SyncBidirectional(v *vault.Vault, store *cache.Store, credPath, tokenJSON, folderID string, notes, databases bool) (*SyncResult, error) {
	credJSON := credPath
	if data, err := os.ReadFile(credPath); err == nil {
		credJSON = string(data)
	}
	return SyncBidirectionalJSON(v, store, credJSON, tokenJSON, folderID, notes, databases)
}

func SyncBidirectionalJSON(v *vault.Vault, store *cache.Store, credJSON, tokenJSON, folderID string, notes, databases bool) (*SyncResult, error) {
	if credJSON == "" {
		return nil, fmt.Errorf("google credentials not configured")
	}
	ctx := context.Background()
	svc, err := newService(ctx, credJSON, tokenJSON)
	if err != nil {
		return nil, err
	}

	idx, err := store.Load()
	if err != nil {
		return nil, err
	}

	if folderID == "" {
		folderID, err = ensureFolder(ctx, svc, "mindbase-vault")
		if err != nil {
			return nil, err
		}
	}
	idx.GDrive.FolderID = folderID

	res := &SyncResult{}
	remoteIndex, err := listRemoteFiles(ctx, svc, folderID)
	if err != nil {
		return nil, err
	}

	// Pull: remote → local cache
	for rel, remote := range remoteIndex {
		if !shouldPull(rel, notes, databases) {
			continue
		}
		localPath, err := resolveLocalPath(v, rel)
		if err != nil {
			continue
		}
		cached, hasCache := idx.GDrive.Files[rel]
		localInfo, localErr := os.Stat(localPath)

		pull := !hasCache || localErr != nil
		if !pull && localInfo != nil && remote.ModifiedTime != "" {
			if remoteMod, err := time.Parse(time.RFC3339, remote.ModifiedTime); err == nil {
				pull = remoteMod.After(localInfo.ModTime()) && remoteMod.After(cached.RemoteMod)
			}
		}
		if !pull {
			continue
		}
		if err := downloadFile(ctx, svc, remote.Id, localPath); err != nil {
			res.Errors = append(res.Errors, fmt.Sprintf("pull %s: %v", rel, err))
			continue
		}
		info, _ := os.Stat(localPath)
		entry := cache.GDriveFileEntry{DriveID: remote.Id, LastSyncedAt: time.Now().UTC()}
		if remote.ModifiedTime != "" {
			entry.RemoteMod, _ = time.Parse(time.RFC3339, remote.ModifiedTime)
		}
		if info != nil {
			entry.LocalMod = info.ModTime()
		}
		idx.GDrive.Files[rel] = entry
		res.Downloaded++
		res.Paths = append(res.Paths, rel)
	}

	// Push: local → Drive
	pushIndex := map[string]string{}
	for rel, id := range idx.GDrive.Files {
		pushIndex[rel] = id.DriveID
	}
	for rel, id := range remoteIndex {
		pushIndex[rel] = id.Id
	}

	if notes {
		_ = filepath.WalkDir(v.NotesRoot(), func(path string, d os.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			ext := filepath.Ext(path)
			if ext != ".md" && ext != ".excalidraw" {
				return nil
			}
			if strings.Contains(path, ".attachments") {
				return nil
			}
			rel, _ := filepath.Rel(v.NotesRoot(), path)
			rel = filepath.ToSlash(rel)
			info, err := d.Info()
			if err != nil {
				return nil
			}
			cached, hasCache := idx.GDrive.Files[rel]
			if hasCache && !info.ModTime().After(cached.LocalMod) && cached.DriveID != "" {
				return nil
			}
			if err := uploadFile(ctx, svc, folderID, pushIndex, rel, path, res); err != nil {
				res.Errors = append(res.Errors, fmt.Sprintf("push %s: %v", rel, err))
				return nil
			}
			entry := cache.GDriveFileEntry{
				DriveID:      pushIndex[rel],
				LocalMod:     info.ModTime(),
				LastSyncedAt: time.Now().UTC(),
			}
			if remote, ok := remoteIndex[rel]; ok && remote.ModifiedTime != "" {
				entry.RemoteMod, _ = time.Parse(time.RFC3339, remote.ModifiedTime)
			}
			idx.GDrive.Files[rel] = entry
			return nil
		})
	}

	if databases {
		entries, _ := os.ReadDir(v.DatabasesRoot())
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".csv") {
				continue
			}
			path := filepath.Join(v.DatabasesRoot(), e.Name())
			rel := "databases/" + e.Name()
			info, err := e.Info()
			if err != nil {
				continue
			}
			cached, hasCache := idx.GDrive.Files[rel]
			if hasCache && !info.ModTime().After(cached.LocalMod) && cached.DriveID != "" {
				continue
			}
			if err := uploadFile(ctx, svc, folderID, pushIndex, rel, path, res); err != nil {
				res.Errors = append(res.Errors, fmt.Sprintf("push %s: %v", rel, err))
				continue
			}
			entry := cache.GDriveFileEntry{
				DriveID:      pushIndex[rel],
				LocalMod:     info.ModTime(),
				LastSyncedAt: time.Now().UTC(),
			}
			if remote, ok := remoteIndex[rel]; ok && remote.ModifiedTime != "" {
				entry.RemoteMod, _ = time.Parse(time.RFC3339, remote.ModifiedTime)
			}
			idx.GDrive.Files[rel] = entry
		}
	}

	idx.GDrive.LastSync = time.Now().UTC()
	if err := store.Save(idx); err != nil {
		return res, err
	}
	return res, nil
}

func listRemoteFiles(ctx context.Context, svc *drive.Service, folderID string) (map[string]*drive.File, error) {
	index := map[string]*drive.File{}
	pageToken := ""
	for {
		call := svc.Files.List().
			Q(fmt.Sprintf("'%s' in parents and trashed=false", folderID)).
			Fields("nextPageToken, files(id,name,modifiedTime,appProperties,mimeType)")
		if pageToken != "" {
			call = call.PageToken(pageToken)
		}
		list, err := call.Do()
		if err != nil {
			return nil, err
		}
		for _, f := range list.Files {
			if f.MimeType == "application/vnd.google-apps.folder" {
				continue
			}
			rel := f.Name
			if f.AppProperties != nil {
				if p, ok := f.AppProperties["mindbase_path"]; ok {
					rel = p
				}
			}
			index[rel] = f
		}
		if list.NextPageToken == "" {
			break
		}
		pageToken = list.NextPageToken
	}
	return index, nil
}

func downloadFile(ctx context.Context, svc *drive.Service, fileID, dest string) error {
	resp, err := svc.Files.Get(fileID).Download()
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	f, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, resp.Body)
	return err
}

func resolveLocalPath(v *vault.Vault, rel string) (string, error) {
	if strings.HasPrefix(rel, "databases/") {
		name := strings.TrimPrefix(rel, "databases/")
		return v.ResolveDatabasePath(strings.TrimSuffix(name, ".csv"))
	}
	return v.ResolveNotePath(rel)
}

func shouldPull(rel string, notes, databases bool) bool {
	if strings.HasPrefix(rel, "databases/") {
		return databases
	}
	return notes
}
