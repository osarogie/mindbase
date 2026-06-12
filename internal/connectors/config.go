package connectors

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/osarogie/mindbase/internal/ai"
	"github.com/osarogie/mindbase/internal/vault"
)

const ConfigFile = "connectors.json"

const (
	ConnectorNotion = "notion"
	ConnectorGDrive = "gdrive"
)

var (
	ErrSourceSinkSame     = errors.New("source and sink must be different connectors")
	ErrUnknownConnector   = errors.New("unknown connector")
	ErrNotionSinkUnsupported = errors.New("notion as sink is not supported yet")
)

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
	Source           string       `json:"source"`
	Sink             string       `json:"sink"`
	AutoSync         bool         `json:"auto_sync"`
	SyncIntervalMin  int          `json:"sync_interval_min"`
	Version          int          `json:"version"`
}

func DefaultConfig() Config {
	return Config{
		Version:         1,
		Source:          ConnectorNotion,
		Sink:            ConnectorGDrive,
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
	cfg = normalizeSourceSink(cfg)
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

func normalizeSourceSink(cfg Config) Config {
	cfg.Source = normalizeConnectorID(cfg.Source)
	cfg.Sink = normalizeConnectorID(cfg.Sink)
	if cfg.Source == "" && cfg.Sink == "" {
		cfg.Source = ConnectorNotion
		cfg.Sink = ConnectorGDrive
	}
	if cfg.Source == "" {
		cfg.Source = defaultSourceForSink(cfg.Sink)
	}
	if cfg.Sink == "" {
		cfg.Sink = defaultSinkForSource(cfg.Source)
	}
	cfg = applyRoleEnabled(cfg)
	return cfg
}

func normalizeConnectorID(id string) string {
	switch strings.ToLower(strings.TrimSpace(id)) {
	case ConnectorNotion:
		return ConnectorNotion
	case ConnectorGDrive, "google", "google_drive":
		return ConnectorGDrive
	default:
		return ""
	}
}

func defaultSourceForSink(sink string) string {
	if sink == ConnectorNotion {
		return ConnectorGDrive
	}
	return ConnectorNotion
}

func defaultSinkForSource(source string) string {
	if source == ConnectorGDrive {
		return ConnectorNotion
	}
	return ConnectorGDrive
}

func applyRoleEnabled(cfg Config) Config {
	cfg.Notion.Enabled = cfg.ConnectorEnabled(ConnectorNotion)
	cfg.GDrive.Enabled = cfg.ConnectorEnabled(ConnectorGDrive)
	cfg.Notion.AutoSync = cfg.Notion.Enabled
	cfg.GDrive.AutoSync = cfg.GDrive.Enabled
	return cfg
}

func (cfg Config) ConnectorEnabled(id string) bool {
	return cfg.Source == id || cfg.Sink == id
}

func ValidateSourceSink(cfg Config) error {
	if raw := strings.TrimSpace(cfg.Source); raw != "" && normalizeConnectorID(raw) == "" {
		return fmt.Errorf("%w: source %q", ErrUnknownConnector, raw)
	}
	if raw := strings.TrimSpace(cfg.Sink); raw != "" && normalizeConnectorID(raw) == "" {
		return fmt.Errorf("%w: sink %q", ErrUnknownConnector, raw)
	}
	cfg = normalizeSourceSink(cfg)
	if cfg.Source == "" || cfg.Sink == "" {
		return fmt.Errorf("%w: set both source and sink", ErrUnknownConnector)
	}
	if cfg.Source == cfg.Sink {
		return ErrSourceSinkSame
	}
	if cfg.Sink == ConnectorNotion {
		return ErrNotionSinkUnsupported
	}
	return nil
}

func applyCredentialDefaults(v *vault.Vault, cfg Config) (Config, bool) {
	creds := resolveCredentials(v, cfg)
	prevSource, prevSink := cfg.Source, cfg.Sink
	cfg = normalizeSourceSink(cfg)
	changed := cfg.Source != prevSource || cfg.Sink != prevSink
	if creds.NotionToken != "" || creds.GDriveCredJSON != "" {
		if !cfg.AutoSync {
			cfg.AutoSync = true
			changed = true
		}
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
