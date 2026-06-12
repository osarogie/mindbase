package connectors

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/osarogie/mindbase/internal/vault"
)

// LoadEnvFiles loads connector credentials from vault and user env files.
// Existing process env vars are not overwritten.
func LoadEnvFiles(v *vault.Vault) {
	paths := []string{
		filepath.Join(v.Root, vault.MetaDir, "env"),
	}
	if home, err := os.UserHomeDir(); err == nil {
		paths = append(paths, filepath.Join(home, ".mindbase", "env"))
	}
	for _, path := range paths {
		loadEnvFile(path)
	}
}

func loadEnvFile(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.TrimSpace(val)
		val = strings.Trim(val, `"'`)
		if key != "" && os.Getenv(key) == "" {
			_ = os.Setenv(key, val)
		}
	}
}
