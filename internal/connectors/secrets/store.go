package secrets

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/osarogie/mindbase/internal/vault"
)

const secretsFile = "secrets.json"

type Store struct {
	path string
}

type Data struct {
	NotionToken              string `json:"notion_token,omitempty"`
	AnthropicAPIKey          string `json:"anthropic_api_key,omitempty"`
	GDriveCredentialsJSON    string `json:"gdrive_credentials_json,omitempty"`
	GDriveTokenJSON          string `json:"gdrive_token_json,omitempty"`
	GoogleOAuthClientJSON    string `json:"google_oauth_client_json,omitempty"`
	NotionOAuthClientID      string `json:"notion_oauth_client_id,omitempty"`
	NotionOAuthClientSecret  string `json:"notion_oauth_client_secret,omitempty"`
	NotionOAuthAccessToken   string `json:"notion_oauth_access_token,omitempty"`
}

type View struct {
	NotionTokenSet          bool   `json:"notion_token_set"`
	NotionTokenPreview      string `json:"notion_token_preview,omitempty"`
	NotionOAuthConfigured   bool   `json:"notion_oauth_configured"`
	NotionOAuthConnected    bool   `json:"notion_oauth_connected"`
	GDriveConnected         bool   `json:"gdrive_connected"`
	GDriveAuthMethod        string `json:"gdrive_auth_method,omitempty"`
	GDriveTokenPreview      string `json:"gdrive_token_preview,omitempty"`
	GoogleOAuthConfigured   bool   `json:"google_oauth_configured"`
	AnthropicKeySet         bool   `json:"anthropic_key_set"`
	AnthropicKeyPreview     string `json:"anthropic_key_preview,omitempty"`
}

func New(v *vault.Vault) *Store {
	return &Store{path: filepath.Join(v.Root, vault.MetaDir, secretsFile)}
}

func (s *Store) Load() (Data, error) {
	data, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			return Data{}, nil
		}
		return Data{}, err
	}
	var out Data
	if err := json.Unmarshal(data, &out); err != nil {
		return Data{}, err
	}
	return out, nil
}

func (s *Store) Save(data Data) error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, raw, 0o600)
}

func (s *Store) View() (View, error) {
	data, err := s.Load()
	if err != nil {
		return View{}, err
	}
	v := View{
		NotionTokenSet:        data.NotionToken != "" || data.NotionOAuthAccessToken != "",
		NotionTokenPreview:    previewToken(firstNonEmpty(data.NotionOAuthAccessToken, data.NotionToken)),
		NotionOAuthConfigured: data.NotionOAuthClientID != "" && data.NotionOAuthClientSecret != "",
		NotionOAuthConnected:  data.NotionOAuthAccessToken != "",
		AnthropicKeySet:       data.AnthropicAPIKey != "",
		AnthropicKeyPreview:   previewToken(data.AnthropicAPIKey),
		GoogleOAuthConfigured: data.GoogleOAuthClientJSON != "",
	}
	switch {
	case data.GDriveTokenJSON != "" && data.GoogleOAuthClientJSON != "":
		v.GDriveConnected = true
		v.GDriveAuthMethod = "oauth"
		v.GDriveTokenPreview = "Google account connected"
	case data.GDriveCredentialsJSON != "":
		v.GDriveConnected = true
		v.GDriveAuthMethod = "service_account"
		v.GDriveTokenPreview = "Service account configured"
	case data.GDriveTokenJSON != "":
		v.GDriveConnected = true
		v.GDriveAuthMethod = "token"
	}
	return v, nil
}

func previewToken(token string) string {
	token = strings.TrimSpace(token)
	if token == "" {
		return ""
	}
	if len(token) <= 8 {
		return "••••"
	}
	return token[:4] + "…" + token[len(token)-4:]
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
