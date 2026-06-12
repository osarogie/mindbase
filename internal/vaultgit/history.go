package vaultgit

import (
	"bufio"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// Commit is one vault git commit.
type Commit struct {
	Hash    string   `json:"hash"`
	Short   string   `json:"short"`
	Author  string   `json:"author"`
	Email   string   `json:"email"`
	Date    string   `json:"date"`
	Subject string   `json:"subject"`
	Files   []string `json:"files,omitempty"`
}

// StatusLine is one line from git status --porcelain.
type StatusLine struct {
	Index  string `json:"index"`
	Work   string `json:"work"`
	Path   string `json:"path"`
	Status string `json:"status"`
}

// LogOptions controls git log output.
type LogOptions struct {
	Limit   int
	Path    string
	Oneline bool
	JSON    bool
}

// HasRepo reports whether the vault has a git repository.
func HasRepo(root string) bool {
	if _, err := exec.LookPath("git"); err != nil {
		return false
	}
	out, err := gitOutput(root, "rev-parse", "--git-dir")
	return err == nil && strings.TrimSpace(out) != ""
}

// Log returns recent commits for the vault.
func Log(root string, opts LogOptions) ([]Commit, error) {
	if _, err := exec.LookPath("git"); err != nil {
		return nil, fmt.Errorf("git not installed")
	}
	if !HasRepo(root) {
		return nil, fmt.Errorf("vault is not a git repository (run a save first)")
	}

	limit := opts.Limit
	if limit <= 0 {
		limit = 20
	}

	args := []string{
		"log",
		fmt.Sprintf("-n%d", limit),
		"--pretty=format:---%nhash:%H%nshort:%h%nauthor:%an%nemail:%ae%ndate:%aI%nsubject:%s",
		"--name-only",
	}
	if opts.Path != "" {
		args = append(args, "--", opts.Path)
	}

	out, err := gitOutput(root, args...)
	if err != nil {
		if _, revErr := gitOutput(root, "rev-parse", "HEAD"); revErr != nil {
			return []Commit{}, nil
		}
		return nil, err
	}
	return parseLog(out), nil
}

// Show returns patch output for a commit.
func Show(root, rev string) (string, error) {
	if _, err := exec.LookPath("git"); err != nil {
		return "", fmt.Errorf("git not installed")
	}
	if !HasRepo(root) {
		return "", fmt.Errorf("vault is not a git repository")
	}
	if strings.TrimSpace(rev) == "" {
		return "", fmt.Errorf("commit required")
	}
	return gitOutput(root, "show", "--stat", "--patch", rev)
}

// Diff returns diff output for the working tree or a commit range.
func Diff(root string, rev string, path string) (string, error) {
	if _, err := exec.LookPath("git"); err != nil {
		return "", fmt.Errorf("git not installed")
	}
	if !HasRepo(root) {
		return "", fmt.Errorf("vault is not a git repository")
	}
	args := []string{"diff"}
	if rev != "" {
		args = append(args, rev)
	}
	if path != "" {
		args = append(args, "--", path)
	}
	return gitOutput(root, args...)
}

// Status returns parsed porcelain status lines.
func Status(root string) ([]StatusLine, error) {
	if _, err := exec.LookPath("git"); err != nil {
		return nil, fmt.Errorf("git not installed")
	}
	if !HasRepo(root) {
		return []StatusLine{}, nil
	}
	out, err := gitOutput(root, "status", "--porcelain")
	if err != nil {
		return nil, err
	}
	return parseStatus(out), nil
}

func parseLog(raw string) []Commit {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return []Commit{}
	}
	blocks := strings.Split(raw, "---")
	var commits []Commit
	for _, block := range blocks {
		block = strings.TrimSpace(block)
		if block == "" {
			continue
		}
		c, rest := parseCommitHeader(block)
		c.Files = parseNameOnly(rest)
		commits = append(commits, c)
	}
	return commits
}

func parseCommitHeader(block string) (Commit, string) {
	var c Commit
	var filesStart int
	sc := bufio.NewScanner(strings.NewReader(block))
	for sc.Scan() {
		line := sc.Text()
		switch {
		case strings.HasPrefix(line, "hash:"):
			c.Hash = strings.TrimPrefix(line, "hash:")
		case strings.HasPrefix(line, "short:"):
			c.Short = strings.TrimPrefix(line, "short:")
		case strings.HasPrefix(line, "author:"):
			c.Author = strings.TrimPrefix(line, "author:")
		case strings.HasPrefix(line, "email:"):
			c.Email = strings.TrimPrefix(line, "email:")
		case strings.HasPrefix(line, "date:"):
			c.Date = strings.TrimPrefix(line, "date:")
		case strings.HasPrefix(line, "subject:"):
			c.Subject = strings.TrimPrefix(line, "subject:")
		case line == "":
			filesStart = len(strings.Join(splitLines(block), "\n"))
			_ = filesStart
		}
	}
	// Everything after the header blank line is name-only.
	if idx := strings.Index(block, "\n\n"); idx >= 0 {
		rest := strings.TrimSpace(block[idx+2:])
		return c, rest
	}
	return c, ""
}

func parseNameOnly(rest string) []string {
	if rest == "" {
		return nil
	}
	var files []string
	for _, line := range splitLines(rest) {
		line = strings.TrimSpace(line)
		if line != "" {
			files = append(files, line)
		}
	}
	return files
}

func parseStatus(raw string) []StatusLine {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return []StatusLine{}
	}
	var lines []StatusLine
	for _, line := range splitLines(raw) {
		if len(line) < 4 {
			continue
		}
		index := line[0:1]
		work := line[1:2]
		path := strings.TrimSpace(line[3:])
		lines = append(lines, StatusLine{
			Index:  index,
			Work:   work,
			Path:   path,
			Status: describeStatus(index, work),
		})
	}
	return lines
}

func describeStatus(index, work string) string {
	code := index + work
	switch code {
	case "??":
		return "untracked"
	case " M", "M ", "MM":
		return "modified"
	case " A", "A ", "AM":
		return "added"
	case " D", "D ", "MD":
		return "deleted"
	case " R", "R ":
		return "renamed"
	default:
		return strings.TrimSpace(code)
	}
}

// FormatCommitOneline renders one commit like git log --oneline.
func FormatCommitOneline(c Commit) string {
	date := c.Date
	if t, err := time.Parse(time.RFC3339, c.Date); err == nil {
		date = t.Format("2006-01-02 15:04")
	}
	return fmt.Sprintf("%s  %s  %s", c.Short, date, c.Subject)
}
