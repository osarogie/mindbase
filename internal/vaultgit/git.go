package vaultgit

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const (
	notesDir     = "notes"
	databasesDir = "databases"
)

const defaultGitignore = `.mindbase/secrets.json
`

// Ensure initializes a git repository in the vault when git is available.
func Ensure(root string) error {
	if _, err := exec.LookPath("git"); err != nil {
		return nil
	}
	gitDir := filepath.Join(root, ".git")
	if _, err := os.Stat(gitDir); os.IsNotExist(err) {
		if err := runGit(root, "init"); err != nil {
			return err
		}
	}
	giPath := filepath.Join(root, ".gitignore")
	if _, err := os.Stat(giPath); os.IsNotExist(err) {
		if err := os.WriteFile(giPath, []byte(defaultGitignore), 0o644); err != nil {
			return err
		}
	}
	_ = runGit(root, "config", "user.email", "mindbase@local")
	_ = runGit(root, "config", "user.name", "mindbase")
	return nil
}

// Track stages paths (relative to vault root) and commits with message.
func Track(root string, relPaths []string, message string) error {
	if len(relPaths) == 0 {
		return nil
	}
	if _, err := exec.LookPath("git"); err != nil {
		return nil
	}
	if err := Ensure(root); err != nil {
		return err
	}
	args := append([]string{"add", "--"}, relPaths...)
	if err := runGit(root, args...); err != nil {
		return err
	}
	out, err := gitOutput(root, "status", "--porcelain")
	if err != nil || strings.TrimSpace(out) == "" {
		return nil
	}
	return runGit(root, "commit", "-m", message)
}

// NotePath returns the vault-relative path for a note file.
func NotePath(rel string) string {
	return filepath.ToSlash(filepath.Join(notesDir, rel))
}

// DatabasePath returns the vault-relative path for a database file.
func DatabasePath(name string) string {
	clean := filepath.Clean(name)
	if filepath.Ext(clean) != ".csv" {
		clean += ".csv"
	}
	return filepath.ToSlash(filepath.Join(databasesDir, clean))
}

func runGit(root string, args ...string) error {
	cmd := exec.Command("git", args...)
	cmd.Dir = root
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if strings.Contains(msg, "nothing to commit") {
			return nil
		}
		if strings.Contains(msg, "nothing added to commit") {
			return nil
		}
		return fmt.Errorf("git %s: %w (%s)", strings.Join(args, " "), err, msg)
	}
	return nil
}

func gitOutput(root string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = root
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return string(out), nil
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}
