package connectors

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"

	"github.com/osarogie/mindbase/internal/connectors/secrets"
)

type oauthState struct {
	RedirectURI string
	Expires     time.Time
}

type oauthStore struct {
	mu     sync.Mutex
	states map[string]oauthState
}

func newOAuthStore() *oauthStore {
	return &oauthStore{states: map[string]oauthState{}}
}

func (o *oauthStore) put(redirectURI string) (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	state := base64.RawURLEncoding.EncodeToString(b)
	o.mu.Lock()
	defer o.mu.Unlock()
	o.states[state] = oauthState{RedirectURI: redirectURI, Expires: time.Now().Add(10 * time.Minute)}
	return state, nil
}

func (o *oauthStore) take(state string) (oauthState, bool) {
	o.mu.Lock()
	defer o.mu.Unlock()
	entry, ok := o.states[state]
	if !ok || time.Now().After(entry.Expires) {
		delete(o.states, state)
		return oauthState{}, false
	}
	delete(o.states, state)
	return entry, true
}

type UpdateCredentialsRequest struct {
	NotionToken             *string  `json:"notion_token,omitempty"`
	AnthropicAPIKey         *string  `json:"anthropic_api_key,omitempty"`
	GDriveCredentialsJSON   *string  `json:"gdrive_credentials_json,omitempty"`
	GoogleOAuthClientJSON   *string  `json:"google_oauth_client_json,omitempty"`
	NotionOAuthClientID     *string  `json:"notion_oauth_client_id,omitempty"`
	NotionOAuthClientSecret *string  `json:"notion_oauth_client_secret,omitempty"`
	Clear                   []string `json:"clear,omitempty"`
}

func (s *Service) CredentialsView() (secrets.View, error) {
	return secrets.New(s.vault).View()
}

func (s *Service) UpdateCredentials(req UpdateCredentialsRequest) (secrets.View, error) {
	store := secrets.New(s.vault)
	data, err := store.Load()
	if err != nil {
		return secrets.View{}, err
	}
	for _, key := range req.Clear {
		switch key {
		case "notion_token":
			data.NotionToken = ""
			data.NotionOAuthAccessToken = ""
		case "anthropic_api_key":
			data.AnthropicAPIKey = ""
		case "gdrive":
			data.GDriveCredentialsJSON = ""
			data.GDriveTokenJSON = ""
		case "google_oauth":
			data.GoogleOAuthClientJSON = ""
			data.GDriveTokenJSON = ""
		case "notion_oauth":
			data.NotionOAuthClientID = ""
			data.NotionOAuthClientSecret = ""
			data.NotionOAuthAccessToken = ""
		}
	}
	if req.NotionToken != nil {
		data.NotionToken = stringsTrim(*req.NotionToken)
		if data.NotionToken != "" {
			s.config.Notion.Enabled = true
		}
	}
	if req.AnthropicAPIKey != nil {
		data.AnthropicAPIKey = stringsTrim(*req.AnthropicAPIKey)
	}
	if req.GDriveCredentialsJSON != nil {
		data.GDriveCredentialsJSON = stringsTrim(*req.GDriveCredentialsJSON)
		if data.GDriveCredentialsJSON != "" {
			s.config.GDrive.Enabled = true
		}
	}
	if req.GoogleOAuthClientJSON != nil {
		data.GoogleOAuthClientJSON = stringsTrim(*req.GoogleOAuthClientJSON)
	}
	if req.NotionOAuthClientID != nil {
		data.NotionOAuthClientID = stringsTrim(*req.NotionOAuthClientID)
	}
	if req.NotionOAuthClientSecret != nil {
		data.NotionOAuthClientSecret = stringsTrim(*req.NotionOAuthClientSecret)
	}
	if err := store.Save(data); err != nil {
		return secrets.View{}, err
	}
	s.config, _ = applyCredentialDefaults(s.vault, s.config)
	_ = Save(s.vault, s.config)
	view, err := store.View()
	if err != nil {
		return secrets.View{}, err
	}
	return view, nil
}

func stringsTrim(v string) string {
	return strings.TrimSpace(v)
}

func (s *Service) GDriveOAuthStart(redirectURI string) (string, string, error) {
	sec, err := secrets.New(s.vault).Load()
	if err != nil {
		return "", "", err
	}
	if sec.GoogleOAuthClientJSON == "" {
		return "", "", fmt.Errorf("google oauth client json not configured")
	}
	cfg, err := google.ConfigFromJSON([]byte(sec.GoogleOAuthClientJSON), drive.DriveFileScope)
	if err != nil {
		return "", "", err
	}
	cfg.RedirectURL = redirectURI
	state, err := s.gdriveOAuth.put(redirectURI)
	if err != nil {
		return "", "", err
	}
	return cfg.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.ApprovalForce), state, nil
}

func (s *Service) GDriveOAuthCallback(r *http.Request) error {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	if code == "" || state == "" {
		return fmt.Errorf("missing oauth code or state")
	}
	entry, ok := s.gdriveOAuth.take(state)
	if !ok {
		return fmt.Errorf("invalid or expired oauth state")
	}
	sec, err := secrets.New(s.vault).Load()
	if err != nil {
		return err
	}
	cfg, err := google.ConfigFromJSON([]byte(sec.GoogleOAuthClientJSON), drive.DriveFileScope)
	if err != nil {
		return err
	}
	cfg.RedirectURL = entry.RedirectURI
	tok, err := cfg.Exchange(context.Background(), code)
	if err != nil {
		return err
	}
	raw, err := json.Marshal(tok)
	if err != nil {
		return err
	}
	sec.GDriveTokenJSON = string(raw)
	s.config.GDrive.Enabled = true
	s.config.AutoSync = true
	if err := secrets.New(s.vault).Save(sec); err != nil {
		return err
	}
	_ = Save(s.vault, s.config)
	return nil
}

func (s *Service) NotionOAuthStart(redirectURI string) (string, string, error) {
	sec, err := secrets.New(s.vault).Load()
	if err != nil {
		return "", "", err
	}
	if sec.NotionOAuthClientID == "" || sec.NotionOAuthClientSecret == "" {
		return "", "", fmt.Errorf("notion oauth client id/secret not configured")
	}
	state, err := s.notionOAuth.put(redirectURI)
	if err != nil {
		return "", "", err
	}
	q := url.Values{}
	q.Set("client_id", sec.NotionOAuthClientID)
	q.Set("response_type", "code")
	q.Set("owner", "user")
	q.Set("redirect_uri", redirectURI)
	q.Set("state", state)
	return "https://api.notion.com/v1/oauth/authorize?" + q.Encode(), state, nil
}

func (s *Service) NotionOAuthCallback(r *http.Request) error {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	if code == "" || state == "" {
		return fmt.Errorf("missing oauth code or state")
	}
	entry, ok := s.notionOAuth.take(state)
	if !ok {
		return fmt.Errorf("invalid or expired oauth state")
	}
	sec, err := secrets.New(s.vault).Load()
	if err != nil {
		return err
	}
	body := map[string]string{
		"grant_type":   "authorization_code",
		"code":         code,
		"redirect_uri": entry.RedirectURI,
	}
	raw, _ := json.Marshal(body)
	req, err := http.NewRequest(http.MethodPost, "https://api.notion.com/v1/oauth/token", strings.NewReader(string(raw)))
	if err != nil {
		return err
	}
	req.SetBasicAuth(sec.NotionOAuthClientID, sec.NotionOAuthClientSecret)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("notion oauth token exchange failed: %s", resp.Status)
	}
	var tok struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil {
		return err
	}
	if tok.AccessToken == "" {
		return fmt.Errorf("notion oauth returned empty token")
	}
	sec.NotionOAuthAccessToken = tok.AccessToken
	s.config.Notion.Enabled = true
	s.config.AutoSync = true
	if err := secrets.New(s.vault).Save(sec); err != nil {
		return err
	}
	_ = Save(s.vault, s.config)
	return nil
}
