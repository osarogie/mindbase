package connectors

import (
	"os"
	"strings"

	"github.com/osarogie/mindbase/internal/connectors/secrets"
	"github.com/osarogie/mindbase/internal/vault"
)

type ResolvedCredentials struct {
	NotionToken     string
	GDriveCredJSON  string
	GDriveTokenJSON string
	AnthropicKey    string
}

func resolveCredentials(v *vault.Vault, cfg Config) ResolvedCredentials {
	sec, _ := secrets.New(v).Load()
	out := ResolvedCredentials{
		NotionToken:     firstNonEmpty(os.Getenv(cfg.Notion.TokenEnv), sec.NotionOAuthAccessToken, sec.NotionToken),
		GDriveTokenJSON: firstNonEmpty(os.Getenv(cfg.GDrive.TokenEnv), sec.GDriveTokenJSON),
		AnthropicKey:    firstNonEmpty(os.Getenv(cfg.AI.APIKeyEnv), sec.AnthropicAPIKey),
	}
	out.GDriveCredJSON = resolveGDriveCredJSON(cfg, sec)
	return out
}

func resolveGDriveCredJSON(cfg Config, sec secrets.Data) string {
	if path := strings.TrimSpace(os.Getenv(cfg.GDrive.CredentialsEnv)); path != "" {
		if data, err := os.ReadFile(path); err == nil {
			return string(data)
		}
	}
	if sec.GoogleOAuthClientJSON != "" {
		return sec.GoogleOAuthClientJSON
	}
	return sec.GDriveCredentialsJSON
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func hasNotionCredentials(v *vault.Vault, cfg Config) bool {
	return resolveCredentials(v, cfg).NotionToken != ""
}

func hasGDriveCredentials(v *vault.Vault, cfg Config) bool {
	c := resolveCredentials(v, cfg)
	return c.GDriveCredJSON != ""
}

func hasAnthropicCredentials(v *vault.Vault, cfg Config) bool {
	return resolveCredentials(v, cfg).AnthropicKey != ""
}
