package connectors

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"github.com/osarogie/mindbase/internal/ai"
	"github.com/osarogie/mindbase/internal/vault"
)

const ConfigFile = "connectors.json"

type NotionConfig struct {
	Enabled         bool      `json:"enabled"`
	AutoSync        bool      `json:"auto_sync"`
	TokenEnv        string    `json:"token_env"`
	LastImport      time.Time `json:"last_import,omitempty"`
	ImportDir       string    `json:"import_dir,omitempty"`
}

type GDriveConfig struct {
	Enabled         bool      `json:"enabled"`
	AutoSync        bool      `json:"auto_sync"`
	CredentialsEnv  string    `json:"credentials_env"`
	TokenEnv        string    `json:"token_env"`
	FolderID        string    `json:"folder_id"`
	LastSync        time.Time `json:"last_sync,omitempty"`
	MirrorNotes     bool      `json:"mirror_notes"`
	MirrorDatabases bool      `json:"mirror_databases"`
}

type Config struct {
	Notion           NotionConfig `json:"notion"`
	GDrive           GDriveConfig `json:"gdrive"`
	AI               ai.Config    `json:"ai"`
	AutoSync         bool         `json:"auto_sync"`
	SyncIntervalMin  int          `json:"sync_interval_min"`
	Version          int          `json:"version"`
}

func DefaultConfig() Config {
	return Config{
		Version:         1,
		AutoSync:        true,
		SyncIntervalMin: 15,
		Notion: NotionConfig{
			Enabled:   true,
			AutoSync:  true,
			TokenEnv:  "NOTION_TOKEN",
			ImportDir: "notion",
		},
		GDrive: GDriveConfig{
			Enabled:         true,
			AutoSync:        true,
			CredentialsEnv:  "GOOGLE_APPLICATION_CREDENTIALS",
			TokenEnv:        "GDRIVE_TOKEN",
			MirrorNotes:     true,
			MirrorDatabases: true,
		},
		AI: ai.DefaultConfig(),
	}
}

func Load(v *vault.Vault) (Config, error) {
	LoadEnvFiles(v)
	path := filepath.Join(v.Root, vault.MetaDir, ConfigFile)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			cfg := DefaultConfig()
			if saveErr := Save(v, cfg); saveErr != nil {
				return cfg, saveErr
			}
			return cfg, nil
		}
		return Config{}, err
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return DefaultConfig(), err
	}
	cfg = normalizeConfig(cfg)
	if cfg.Version == 0 {
		cfg.Version = 1
	}
	if cfg.Notion.TokenEnv == "" {
		cfg.Notion.TokenEnv = "NOTION_TOKEN"
	}
	if cfg.GDrive.CredentialsEnv == "" {
		cfg.GDrive.CredentialsEnv = "GOOGLE_APPLICATION_CREDENTIALS"
	}
	if cfg.AI.APIKeyEnv == "" {
		cfg.AI.APIKeyEnv = "ANTHROPIC_API_KEY"
	}
	if cfg.AI.HeadroomURL == "" {
		cfg.AI.HeadroomURL = "http://localhost:8787"
	}
	if cfg.AI.Model == "" {
		cfg.AI.Model = "claude-sonnet-4-20250514"
	}
	if cfg.AI.MaxTokens == 0 {
		cfg.AI.MaxTokens = 4096
	}
	if cfg.SyncIntervalMin == 0 {
		cfg.SyncIntervalMin = 15
	}
	if cfg.Notion.ImportDir == "" {
		cfg.Notion.ImportDir = "notion"
	}
	cfg, changed := applyCredentialDefaults(v, cfg)
	if changed {
		_ = Save(v, cfg)
	}
	return cfg, nil
}

func normalizeConfig(cfg Config) Config {
	if cfg.Notion.ImportDir == "" || cfg.Notion.ImportDir == "notion-import" {
		cfg.Notion.ImportDir = "notion"
	}
	return cfg
}

func applyCredentialDefaults(v *vault.Vault, cfg Config) (Config, bool) {
	changed := false
	creds := resolveCredentials(v, cfg)
	if creds.NotionToken != "" {
		if !cfg.Notion.Enabled {
			cfg.Notion.Enabled = true
			changed = true
		}
		if !cfg.Notion.AutoSync {
			cfg.Notion.AutoSync = true
			changed = true
		}
	}
	if creds.GDriveCredJSON != "" {
		if !cfg.GDrive.Enabled {
			cfg.GDrive.Enabled = true
			changed = true
		}
		if !cfg.GDrive.AutoSync {
			cfg.GDrive.AutoSync = true
			changed = true
		}
	}
	if (cfg.Notion.Enabled || cfg.GDrive.Enabled) && !cfg.AutoSync {
		cfg.AutoSync = true
		changed = true
	}
	return cfg, changed
}

func Save(v *vault.Vault, cfg Config) error {
	path := filepath.Join(v.Root, vault.MetaDir, ConfigFile)
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func EnvOrEmpty(key string) string {
	if key == "" {
		return ""
	}
	return os.Getenv(key)
}
