package connectors

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/osarogie/mindbase/internal/connectors/cache"
	"github.com/osarogie/mindbase/internal/connectors/gdrive"
	"github.com/osarogie/mindbase/internal/connectors/notion"
)

type Scheduler struct {
	svc    *Service
	stop   chan struct{}
	done   sync.WaitGroup
	mu     sync.Mutex
	running bool
}

func NewScheduler(svc *Service) *Scheduler {
	return &Scheduler{svc: svc, stop: make(chan struct{})}
}

func (sch *Scheduler) Start() {
	sch.mu.Lock()
	if sch.running {
		sch.mu.Unlock()
		return
	}
	sch.running = true
	sch.mu.Unlock()

	sch.done.Add(1)
	go func() {
		defer sch.done.Done()
		// Initial sync shortly after startup
		time.Sleep(2 * time.Second)
		sch.runSync()

		interval := time.Duration(sch.svc.config.SyncIntervalMin) * time.Minute
		if interval < time.Minute {
			interval = 15 * time.Minute
		}
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				sch.runSync()
			case <-sch.stop:
				return
			}
		}
	}()
}

func (sch *Scheduler) Stop() {
	close(sch.stop)
	sch.done.Wait()
}

func (sch *Scheduler) runSync() {
	LoadEnvFiles(sch.svc.vault)
	sch.svc.config, _ = applyCredentialDefaults(sch.svc.vault, sch.svc.config)
	creds := resolveCredentials(sch.svc.vault, sch.svc.config)
	if !sch.svc.config.AutoSync && creds.NotionToken == "" && creds.GDriveCredJSON == "" {
		return
	}
	res, err := sch.svc.SyncAll(context.Background())
	if err != nil {
		log.Printf("mindbase connector sync: %v", err)
		return
	}
	if res.Notion != nil || res.GDrive != nil {
		log.Printf("mindbase cache sync: notion=%+v gdrive=%+v", res.Notion, res.GDrive)
	}
}

type AllSyncResult struct {
	Notion *NotionSyncSummary `json:"notion,omitempty"`
	GDrive *GDriveSyncSummary `json:"gdrive,omitempty"`
	Cache  map[string]any     `json:"cache"`
}

type NotionSyncSummary struct {
	Imported int    `json:"imported"`
	Updated  int    `json:"updated"`
	Skipped  int    `json:"skipped"`
	Cached   int    `json:"cached"`
	Error    string `json:"error,omitempty"`
}

type GDriveSyncSummary struct {
	Uploaded   int    `json:"uploaded"`
	Updated    int    `json:"updated"`
	Downloaded int    `json:"downloaded"`
	Error      string `json:"error,omitempty"`
}

func (s *Service) CacheStats() (map[string]any, error) {
	store := cache.New(s.vault)
	idx, err := store.Load()
	if err != nil {
		return nil, err
	}
	return store.Stats(idx), nil
}

func (s *Service) SyncAll(ctx context.Context) (*AllSyncResult, error) {
	_ = ctx
	LoadEnvFiles(s.vault)
	s.config, _ = applyCredentialDefaults(s.vault, s.config)
	creds := resolveCredentials(s.vault, s.config)

	out := &AllSyncResult{}
	// #region agent log
	agentLog("scheduler.go:SyncAll", "sync start", "H2", map[string]any{
		"notion_enabled": s.config.Notion.Enabled,
		"gdrive_enabled": s.config.GDrive.Enabled,
		"auto_sync":      s.config.AutoSync,
		"notion_token":   creds.NotionToken != "",
		"gdrive_cred":    creds.GDriveCredJSON != "",
	})
	// #endregion

	store := cache.New(s.vault)
	idx, _ := store.Load()
	out.Cache = store.Stats(idx)

	if s.config.Notion.Enabled && creds.NotionToken != "" {
		subdir := s.config.Notion.ImportDir
		if subdir == "" {
			subdir = "notion"
		}
		res, err := notion.Sync(s.vault, store, creds.NotionToken, subdir)
		if err != nil {
			out.Notion = &NotionSyncSummary{Error: err.Error()}
		} else {
			out.Notion = &NotionSyncSummary{
				Imported: res.Imported,
				Updated:  res.Updated,
				Skipped:  res.Skipped,
				Cached:   res.Cached,
			}
			s.config.Notion.LastImport = time.Now().UTC()
		}
	}

	if s.config.GDrive.Enabled && creds.GDriveCredJSON != "" {
		res, err := gdrive.SyncBidirectionalJSON(
			s.vault, store,
			creds.GDriveCredJSON,
			creds.GDriveTokenJSON,
			s.config.GDrive.FolderID,
			s.config.GDrive.MirrorNotes,
			s.config.GDrive.MirrorDatabases,
		)
		if err != nil {
			out.GDrive = &GDriveSyncSummary{Error: err.Error()}
		} else {
			out.GDrive = &GDriveSyncSummary{
				Uploaded:   res.Uploaded,
				Updated:    res.Updated,
				Downloaded: res.Downloaded,
			}
			if res.Paths != nil && s.config.GDrive.FolderID == "" {
				if idx2, err := store.Load(); err == nil {
					s.config.GDrive.FolderID = idx2.GDrive.FolderID
				}
			}
			s.config.GDrive.LastSync = time.Now().UTC()
		}
	}

	_ = Save(s.vault, s.config)
	if idx2, err := store.Load(); err == nil {
		out.Cache = store.Stats(idx2)
	}
	// #region agent log
	agentLog("scheduler.go:SyncAll", "sync complete", "H2", map[string]any{
		"notion_imported": out.Notion != nil && out.Notion.Error == "" && out.Notion.Imported+out.Notion.Updated > 0,
		"notion_error":    notionErr(out.Notion),
		"gdrive_error":    gdriveErr(out.GDrive),
		"cache":           out.Cache,
	})
	// #endregion
	return out, nil
}

func notionErr(s *NotionSyncSummary) string {
	if s == nil {
		return ""
	}
	return s.Error
}

func gdriveErr(s *GDriveSyncSummary) string {
	if s == nil {
		return ""
	}
	return s.Error
}
