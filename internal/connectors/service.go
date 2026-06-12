package connectors

import (
	"time"

	"github.com/osarogie/mindbase/internal/connectors/cache"
	"github.com/osarogie/mindbase/internal/connectors/gdrive"
	"github.com/osarogie/mindbase/internal/connectors/notion"
	"github.com/osarogie/mindbase/internal/vault"
)

type Status struct {
	Notion  NotionStatus  `json:"notion"`
	GDrive  GDriveStatus  `json:"gdrive"`
	AI      AIStatus      `json:"ai"`
	Cache   map[string]any `json:"cache"`
	Config  Config        `json:"config"`
}

type NotionStatus struct {
	Connected  bool      `json:"connected"`
	LastImport time.Time `json:"last_import,omitempty"`
	ImportDir  string    `json:"import_dir"`
	CachedPages int      `json:"cached_pages"`
}

type GDriveStatus struct {
	Connected    bool      `json:"connected"`
	LastSync     time.Time `json:"last_sync,omitempty"`
	FolderID     string    `json:"folder_id"`
	CachedFiles  int       `json:"cached_files"`
}

type AIStatus struct {
	Enabled       bool   `json:"enabled"`
	ClaudeReady   bool   `json:"claude_ready"`
	HeadroomURL   string `json:"headroom_url"`
	HeadroomReady bool   `json:"headroom_ready"`
	RTKEnabled    bool   `json:"rtk_enabled"`
	Model         string `json:"model"`
}

type Service struct {
	vault        *vault.Vault
	config       Config
	scheduler    *Scheduler
	gdriveOAuth  *oauthStore
	notionOAuth  *oauthStore
}

func NewService(v *vault.Vault) (*Service, error) {
	LoadEnvFiles(v)
	cfg, err := Load(v)
	if err != nil {
		return nil, err
	}
	s := &Service{
		vault:       v,
		config:      cfg,
		gdriveOAuth: newOAuthStore(),
		notionOAuth: newOAuthStore(),
	}
	s.scheduler = NewScheduler(s)
	return s, nil
}

func (s *Service) StartBackgroundSync() {
	s.scheduler.Start()
}

func (s *Service) StopBackgroundSync() {
	if s.scheduler != nil {
		s.scheduler.Stop()
	}
}

func (s *Service) Vault() *vault.Vault {
	return s.vault
}

func (s *Service) Config() Config {
	return s.config
}

func (s *Service) UpdateConfig(cfg Config) error {
	s.config = cfg
	return Save(s.vault, cfg)
}

func (s *Service) Status(headroomOK bool) Status {
	creds := resolveCredentials(s.vault, s.config)

	cacheStats := map[string]any{}
	if store := cache.New(s.vault); store != nil {
		if idx, err := store.Load(); err == nil {
			cacheStats = store.Stats(idx)
		}
	}

	notionPages := 0
	gdriveFiles := 0
	if v, ok := cacheStats["notion_pages"].(int); ok {
		notionPages = v
	}
	if v, ok := cacheStats["gdrive_files"].(int); ok {
		gdriveFiles = v
	}

	return Status{
		Notion: NotionStatus{
			Connected:   creds.NotionToken != "",
			LastImport:  s.config.Notion.LastImport,
			ImportDir:   s.config.Notion.ImportDir,
			CachedPages: notionPages,
		},
		GDrive: GDriveStatus{
			Connected:   creds.GDriveCredJSON != "",
			LastSync:    s.config.GDrive.LastSync,
			FolderID:    s.config.GDrive.FolderID,
			CachedFiles: gdriveFiles,
		},
		AI: AIStatus{
			Enabled:       s.config.AI.Enabled,
			ClaudeReady:   creds.AnthropicKey != "",
			HeadroomURL:   s.config.AI.HeadroomURL,
			HeadroomReady: headroomOK,
			RTKEnabled:    s.config.AI.RTKEnabled,
			Model:         s.config.AI.Model,
		},
		Cache:  cacheStats,
		Config: s.config,
	}
}

func (s *Service) ImportNotion() (*notion.ImportResult, error) {
	creds := resolveCredentials(s.vault, s.config)
	subdir := s.config.Notion.ImportDir
	if subdir == "" {
		subdir = "notion"
	}
	return notion.Import(s.vault, creds.NotionToken, subdir)
}

func (s *Service) SyncGDrive() (*gdrive.SyncResult, error) {
	creds := resolveCredentials(s.vault, s.config)
	cfg := normalizeSourceSink(s.config)
	var (
		res *gdrive.SyncResult
		err error
	)
	switch {
	case cfg.Sink == ConnectorGDrive:
		res, err = gdrive.SyncPushJSON(
			s.vault, cache.New(s.vault),
			creds.GDriveCredJSON,
			creds.GDriveTokenJSON,
			s.config.GDrive.FolderID,
			s.config.GDrive.MirrorNotes,
			s.config.GDrive.MirrorDatabases,
		)
	case cfg.Source == ConnectorGDrive:
		res, err = gdrive.SyncPullJSON(
			s.vault, cache.New(s.vault),
			creds.GDriveCredJSON,
			creds.GDriveTokenJSON,
			s.config.GDrive.FolderID,
			s.config.GDrive.MirrorNotes,
			s.config.GDrive.MirrorDatabases,
		)
	default:
		res, err = gdrive.SyncBidirectionalJSON(
			s.vault, cache.New(s.vault),
			creds.GDriveCredJSON,
			creds.GDriveTokenJSON,
			s.config.GDrive.FolderID,
			s.config.GDrive.MirrorNotes,
			s.config.GDrive.MirrorDatabases,
		)
	}
	if err != nil {
		return nil, err
	}
	s.config.GDrive.LastSync = time.Now().UTC()
	_ = Save(s.vault, s.config)
	return res, nil
}
