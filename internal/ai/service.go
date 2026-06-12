package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/osarogie/mindbase/internal/search"
	"github.com/osarogie/mindbase/internal/vault"
)

type Service struct {
	vault  *vault.Vault
	search *search.Service
	config Config
}

func NewService(v *vault.Vault, cfg Config) *Service {
	return &Service{
		vault:  v,
		search: search.NewService(v),
		config: cfg,
	}
}

type ChatRequest struct {
	Message  string `json:"message"`
	NotePath string `json:"note_path,omitempty"`
	UseVault bool   `json:"use_vault"`
}

type ChatResponse struct {
	Reply            string `json:"reply"`
	Model            string `json:"model"`
	TokensSaved      int    `json:"tokens_saved,omitempty"`
	HeadroomUsed     bool   `json:"headroom_used"`
	RTKUsed          bool   `json:"rtk_used"`
	ContextChars     int    `json:"context_chars"`
	CompressedChars  int    `json:"compressed_chars,omitempty"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type compressResult struct {
	Messages []Message `json:"messages"`
	Saved    int       `json:"tokens_saved"`
}

func (s *Service) Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	return s.ChatWithKey(ctx, "", req)
}

func (s *Service) ChatWithKey(ctx context.Context, apiKey string, req ChatRequest) (*ChatResponse, error) {
	key := apiKey
	if key == "" {
		key = os.Getenv(s.config.APIKeyEnv)
	}
	if key == "" {
		return nil, fmt.Errorf("anthropic api key not set (%s)", s.config.APIKeyEnv)
	}

	system := "You are mindbase assistant — a helpful AI embedded in a local-first Notion-like notes app. Be concise. Use markdown when helpful."
	var contextBlock strings.Builder

	if req.UseVault {
		q := req.Message
		if q == "" {
			q = "overview"
		}
		results, err := s.search.Query(q)
		if err == nil && len(results) > 0 {
			contextBlock.WriteString("Relevant vault context:\n")
			for i, r := range results {
				if i >= 8 {
					break
				}
				contextBlock.WriteString(fmt.Sprintf("- [%s] %s: %s\n", r.Type, r.Title, r.Snippet))
			}
		}
	}

	if req.NotePath != "" {
		full, err := s.vault.ResolveNotePath(req.NotePath)
		if err == nil {
			data, err := os.ReadFile(full)
			if err == nil {
				contextBlock.WriteString("\nCurrent note:\n")
				contextBlock.WriteString(string(data))
			}
		}
	}

	userContent := req.Message
	if contextBlock.Len() > 0 {
		ctxText := contextBlock.String()
		rtkUsed := false
		if s.config.RTKEnabled {
			if compressed, ok := compressRTK(ctxText); ok {
				ctxText = compressed
				rtkUsed = true
			}
		}
		userContent = ctxText + "\n\n---\nUser request: " + req.Message

		messages := []Message{
			{Role: "system", Content: system},
			{Role: "user", Content: userContent},
		}

		compressed, headroomUsed, saved, compChars := s.compressViaHeadroom(ctx, messages)
		reply, err := s.callClaude(ctx, key, compressed)
		if err != nil {
			return nil, err
		}
		return &ChatResponse{
			Reply:           reply,
			Model:           s.config.Model,
			TokensSaved:     saved,
			HeadroomUsed:    headroomUsed,
			RTKUsed:         rtkUsed,
			ContextChars:    contextBlock.Len(),
			CompressedChars: compChars,
		}, nil
	}

	messages := []Message{
		{Role: "system", Content: system},
		{Role: "user", Content: userContent},
	}
	compressed, headroomUsed, saved, compChars := s.compressViaHeadroom(ctx, messages)
	reply, err := s.callClaude(ctx, key, compressed)
	if err != nil {
		return nil, err
	}
	return &ChatResponse{
		Reply:           reply,
		Model:           s.config.Model,
		TokensSaved:     saved,
		HeadroomUsed:    headroomUsed,
		ContextChars:    len(userContent),
		CompressedChars: compChars,
	}, nil
}

func (s *Service) compressViaHeadroom(ctx context.Context, messages []Message) ([]Message, bool, int, int) {
	if s.config.HeadroomURL == "" {
		return messages, false, 0, totalChars(messages)
	}
	body, _ := json.Marshal(map[string]any{
		"messages": messages,
		"model":    s.config.Model,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(s.config.HeadroomURL, "/")+"/v1/compress", bytes.NewReader(body))
	if err != nil {
		return messages, false, 0, totalChars(messages)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode >= 400 {
		if resp != nil {
			resp.Body.Close()
		}
		return messages, false, 0, totalChars(messages)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return messages, false, 0, totalChars(messages)
	}
	var res compressResult
	if err := json.Unmarshal(data, &res); err != nil || len(res.Messages) == 0 {
		return messages, false, 0, totalChars(messages)
	}
	return res.Messages, true, res.Saved, totalChars(res.Messages)
}

func totalChars(msgs []Message) int {
	n := 0
	for _, m := range msgs {
		n += len(m.Content)
	}
	return n
}

func (s *Service) callClaude(ctx context.Context, key string, messages []Message) (string, error) {
	var system string
	var userMsgs []Message
	for _, m := range messages {
		if m.Role == "system" {
			system = m.Content
		} else {
			userMsgs = append(userMsgs, m)
		}
	}
	if len(userMsgs) == 0 {
		return "", fmt.Errorf("no user message")
	}

	payload := map[string]any{
		"model":      s.config.Model,
		"max_tokens": s.config.MaxTokens,
		"messages":   toAnthropic(userMsgs),
	}
	if system != "" {
		payload["system"] = system
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", key)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("anthropic api: %s", string(data))
	}

	var out struct {
		Content []struct {
			Text string `json:"text"`
			Type string `json:"type"`
		} `json:"content"`
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return "", err
	}
	var parts []string
	for _, c := range out.Content {
		if c.Type == "text" {
			parts = append(parts, c.Text)
		}
	}
	return strings.Join(parts, "\n"), nil
}

func toAnthropic(msgs []Message) []map[string]string {
	out := make([]map[string]string, len(msgs))
	for i, m := range msgs {
		role := m.Role
		if role == "system" {
			role = "user"
		}
		out[i] = map[string]string{"role": role, "content": m.Content}
	}
	return out
}

func compressRTK(text string) (string, bool) {
	path, err := exec.LookPath("rtk")
	if err != nil {
		return text, false
	}
	cmd := exec.Command(path, "compress", "-")
	cmd.Stdin = strings.NewReader(text)
	out, err := cmd.Output()
	if err != nil || len(out) == 0 {
		return text, false
	}
	return string(out), true
}

func HeadroomPing(url string) bool {
	if url == "" {
		return false
	}
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(strings.TrimRight(url, "/") + "/health")
	if err != nil {
		// proxy may not expose /health — try compress endpoint with empty body
		resp, err = client.Get(strings.TrimRight(url, "/"))
		if err != nil {
			return false
		}
	}
	defer resp.Body.Close()
	return resp.StatusCode < 500
}
