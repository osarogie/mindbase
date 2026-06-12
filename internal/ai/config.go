package ai

type Config struct {
	Enabled     bool   `json:"enabled"`
	APIKeyEnv   string `json:"api_key_env"`
	HeadroomURL string `json:"headroom_url"`
	RTKEnabled  bool   `json:"rtk_enabled"`
	Model       string `json:"model"`
	MaxTokens   int    `json:"max_tokens"`
}

func DefaultConfig() Config {
	return Config{
		Enabled:     true,
		APIKeyEnv:   "ANTHROPIC_API_KEY",
		HeadroomURL: "http://localhost:8787",
		RTKEnabled:  true,
		Model:       "claude-sonnet-4-20250514",
		MaxTokens:   4096,
	}
}
