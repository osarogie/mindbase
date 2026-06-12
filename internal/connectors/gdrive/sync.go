package gdrive

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/googleapi"
	"google.golang.org/api/option"

	"github.com/osarogie/mindbase/internal/connectors/cache"
	"github.com/osarogie/mindbase/internal/vault"
)

type SyncResult struct {
	Uploaded   int      `json:"uploaded"`
	Updated    int      `json:"updated"`
	Downloaded int      `json:"downloaded"`
	Skipped    int      `json:"skipped"`
	Paths      []string `json:"paths"`
	Errors     []string `json:"errors,omitempty"`
}

func Sync(v *vault.Vault, credPath, tokenJSON, folderID string, notes, databases bool) (*SyncResult, error) {
	credJSON := credPath
	if data, err := os.ReadFile(credPath); err == nil {
		credJSON = string(data)
	}
	return SyncWithJSON(v, credJSON, tokenJSON, folderID, notes, databases)
}

func SyncWithJSON(v *vault.Vault, credJSON, tokenJSON, folderID string, notes, databases bool) (*SyncResult, error) {
	store := cache.New(v)
	return SyncBidirectionalJSON(v, store, credJSON, tokenJSON, folderID, notes, databases)
}

func newService(ctx context.Context, credJSON, tokenJSON string) (*drive.Service, error) {
	if credJSON == "" {
		return nil, fmt.Errorf("google credentials not configured")
	}
	cfg, err := google.ConfigFromJSON([]byte(credJSON), drive.DriveFileScope)
	if err != nil {
		return nil, err
	}
	tok := &oauth2.Token{}
	if tokenJSON != "" {
		if err := json.Unmarshal([]byte(tokenJSON), tok); err != nil {
			return nil, fmt.Errorf("parse token: %w", err)
		}
	}
	client := cfg.Client(ctx, tok)
	return drive.NewService(ctx, option.WithHTTPClient(client))
}

func ensureFolder(ctx context.Context, svc *drive.Service, name string) (string, error) {
	q := fmt.Sprintf("mimeType='application/vnd.google-apps.folder' and name='%s' and trashed=false", name)
	list, err := svc.Files.List().Q(q).Fields("files(id,name)").Do()
	if err != nil {
		return "", err
	}
	if len(list.Files) > 0 {
		return list.Files[0].Id, nil
	}
	f := &drive.File{
		Name:     name,
		MimeType: "application/vnd.google-apps.folder",
	}
	created, err := svc.Files.Create(f).Fields("id").Do()
	if err != nil {
		return "", err
	}
	return created.Id, nil
}

func uploadFile(ctx context.Context, svc *drive.Service, folderID string, index map[string]string, rel, path string, res *SyncResult) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	name := filepath.Base(path)
	mime := "text/plain"
	if strings.HasSuffix(name, ".csv") {
		mime = "text/csv"
	} else if strings.HasSuffix(name, ".md") {
		mime = "text/markdown"
	}

	f := &drive.File{
		Name:    name,
		Parents: []string{folderID},
		AppProperties: map[string]string{
			"mindbase_path": rel,
			"synced_at":     time.Now().UTC().Format(time.RFC3339),
		},
	}

	if id, ok := index[rel]; ok && id != "" {
		_, err = svc.Files.Update(id, f).
			Media(io.NopCloser(strings.NewReader(string(data))), googleapi.ContentType(mime)).
			Do()
		if err != nil {
			return err
		}
		res.Updated++
		res.Paths = append(res.Paths, rel)
		return nil
	}

	created, err := svc.Files.Create(f).
		Media(io.NopCloser(strings.NewReader(string(data))), googleapi.ContentType(mime)).
		Fields("id").
		Do()
	if err != nil {
		return err
	}
	index[rel] = created.Id
	res.Uploaded++
	res.Paths = append(res.Paths, rel)
	return nil
}
