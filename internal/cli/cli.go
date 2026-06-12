package cli

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/osarogie/mindbase/internal/native"
	"github.com/osarogie/mindbase/internal/vaultgit"
)

// Commands routed by mind / mindbase when the first arg is not a flag.
var Commands = map[string]struct{}{
	"log":      {},
	"show":     {},
	"diff":     {},
	"status":   {},
	"snapshot": {},
	"search":   {},
	"note":     {},
	"help":     {},
	"version":  {},
	"-h":       {},
	"-help":    {},
}

// IsCommand reports whether arg is a CLI subcommand.
func IsCommand(arg string) bool {
	if strings.HasPrefix(arg, "-") && arg != "-h" && arg != "-help" {
		return false
	}
	_, ok := Commands[arg]
	return ok
}

// Run executes the agent CLI. prog is the invoked binary name (mind or mindbase).
func Run(prog string, args []string) int {
	cfg := defaultConfig()
	args, cfg = parseLeadingFlags(args, cfg)

	if len(args) == 0 {
		printUsage(prog, os.Stdout)
		return 0
	}

	cmd := args[0]
	rest := args[1:]
	if cmd == "help" || cmd == "-h" || cmd == "-help" {
		printUsage(prog, os.Stdout)
		return 0
	}
	if cmd == "version" {
		fmt.Println("mindbase cli 0.1.0")
		return 0
	}

	switch cmd {
	case "log":
		return runLog(cfg, rest)
	case "show":
		return runShow(cfg, rest)
	case "diff":
		return runDiff(cfg, rest)
	case "status":
		return runStatus(cfg, rest)
	case "snapshot":
		return runSnapshot(cfg, rest)
	case "search":
		return runSearch(cfg, rest)
	case "note":
		return runNote(cfg, rest)
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n", cmd)
		printUsage(prog, os.Stderr)
		return 2
	}
}

type config struct {
	Vault   string
	JSON    bool
	Oneline bool
	Limit   int
}

func defaultConfig() config {
	vault := os.Getenv("MINDBASE_VAULT")
	if vault == "" {
		vault = "./vault"
	}
	if abs, err := filepath.Abs(vault); err == nil {
		vault = abs
	}
	return config{Vault: vault, Limit: 20}
}

func parseLeadingFlags(args []string, cfg config) ([]string, config) {
	var out []string
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--json":
			cfg.JSON = true
		case "--oneline":
			cfg.Oneline = true
		case "--vault":
			if i+1 >= len(args) {
				fmt.Fprintln(os.Stderr, "--vault requires a path")
				return out, cfg
			}
			i++
			cfg.Vault = args[i]
		default:
			if strings.HasPrefix(args[i], "--vault=") {
				cfg.Vault = strings.TrimPrefix(args[i], "--vault=")
			} else {
				out = append(out, args[i])
			}
		}
	}
	if abs, err := filepath.Abs(cfg.Vault); err == nil {
		cfg.Vault = abs
	}
	return out, cfg
}

func parseLogFlags(cfg config, args []string) (config, []string, error) {
	fs := flag.NewFlagSet("log", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	fs.StringVar(&cfg.Vault, "vault", cfg.Vault, "Path to vault directory")
	fs.BoolVar(&cfg.JSON, "json", cfg.JSON, "Emit JSON")
	fs.BoolVar(&cfg.Oneline, "oneline", cfg.Oneline, "One line per commit")
	fs.IntVar(&cfg.Limit, "n", cfg.Limit, "Number of commits")
	if err := fs.Parse(args); err != nil {
		return cfg, nil, err
	}
	return cfg, fs.Args(), nil
}

func runLog(cfg config, args []string) int {
	var err error
	cfg, args, err = parseLogFlags(cfg, args)
	if err != nil {
		return 2
	}
	path := ""
	if len(args) > 0 {
		path = args[0]
	}
	commits, err := vaultgit.Log(cfg.Vault, vaultgit.LogOptions{
		Limit:   cfg.Limit,
		Path:    path,
		Oneline: cfg.Oneline,
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if cfg.JSON {
		return writeJSON(commits)
	}
	if len(commits) == 0 {
		fmt.Println("(no commits)")
		return 0
	}
	for _, c := range commits {
		if cfg.Oneline {
			fmt.Println(vaultgit.FormatCommitOneline(c))
			continue
		}
		fmt.Printf("commit %s\n", c.Hash)
		fmt.Printf("Author: %s <%s>\n", c.Author, c.Email)
		fmt.Printf("Date:   %s\n\n", c.Date)
		fmt.Printf("    %s\n", c.Subject)
		if len(c.Files) > 0 {
			fmt.Println()
			for _, f := range c.Files {
				fmt.Printf("    %s\n", f)
			}
		}
		fmt.Println()
	}
	return 0
}

func runShow(cfg config, args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "usage: show <commit>")
		return 2
	}
	out, err := vaultgit.Show(cfg.Vault, args[0])
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	fmt.Print(out)
	return 0
}

func runDiff(cfg config, args []string) int {
	rev := ""
	path := ""
	if len(args) > 0 {
		rev = args[0]
	}
	if len(args) > 1 {
		path = args[1]
	}
	out, err := vaultgit.Diff(cfg.Vault, rev, path)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if out == "" {
		fmt.Println("(no diff)")
		return 0
	}
	fmt.Print(out)
	return 0
}

func runStatus(cfg config, _ []string) int {
	lines, err := vaultgit.Status(cfg.Vault)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if cfg.JSON {
		return writeJSON(lines)
	}
	if len(lines) == 0 {
		fmt.Println("nothing to commit, working tree clean")
		return 0
	}
	for _, line := range lines {
		fmt.Printf("%s%s %s\n", line.Index, line.Work, line.Path)
	}
	return 0
}

func openEngine(vaultPath string) (*native.Engine, error) {
	return native.Open(vaultPath)
}

func runSnapshot(cfg config, _ []string) int {
	e, err := openEngine(cfg.Vault)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	snap, err := e.Snapshot()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if cfg.JSON {
		return writeJSON(snap)
	}
	fmt.Printf("vault: %s\n", snap.Info.Name)
	fmt.Printf("notes: %d  databases: %d  open tasks: %d\n", len(snap.Notes), len(snap.Databases), snap.OpenTaskCount)
	for _, item := range snap.VaultItems {
		fmt.Printf("  [%s] %s — %s\n", item.Kind, item.Title, item.Path)
	}
	return 0
}

func runSearch(cfg config, args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "usage: search <query>")
		return 2
	}
	query := strings.Join(args, " ")
	e, err := openEngine(cfg.Vault)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	results, err := e.Search(query)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if cfg.JSON {
		return writeJSON(results)
	}
	if len(results) == 0 {
		fmt.Println("(no results)")
		return 0
	}
	for _, r := range results {
		fmt.Printf("%s  %s\n  %s\n\n", r.Path, r.Title, r.Snippet)
	}
	return 0
}

func runNote(cfg config, args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "usage: note list | note get <path>")
		return 2
	}
	e, err := openEngine(cfg.Vault)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	switch args[0] {
	case "list":
		snap, err := e.Snapshot()
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return 1
		}
		if cfg.JSON {
			return writeJSON(snap.Notes)
		}
		for _, n := range snap.Notes {
			fmt.Printf("%s  %s\n", n.Path, n.Title)
		}
		return 0
	case "get":
		if len(args) < 2 {
			fmt.Fprintln(os.Stderr, "usage: note get <path>")
			return 2
		}
		n, err := e.GetNote(args[1])
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return 1
		}
		if cfg.JSON {
			return writeJSON(n)
		}
		fmt.Print(n.Content)
		if !strings.HasSuffix(n.Content, "\n") {
			fmt.Println()
		}
		return 0
	default:
		fmt.Fprintln(os.Stderr, "usage: note list | note get <path>")
		return 2
	}
}

func writeJSON(v any) int {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(v); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	return 0
}

func printUsage(prog string, w *os.File) {
	fmt.Fprintf(w, `Mindbase agent CLI (%s)

Usage:
  %s [--vault PATH] [--json] <command> [args]

Git-style history (vault commits):
  log [-n N] [--oneline] [--json] [path]   Commit history
  show <commit>                            Show commit patch
  diff [commit] [path]                     Working tree diff
  status [--json]                          Working tree status

Vault content (for agents):
  snapshot [--json]                        Vault inventory
  search <query> [--json]                  Full-text search
  note list [--json]                       List notes
  note get <path> [--json]                 Read note body

Environment:
  MINDBASE_VAULT   Default vault path (default: ./vault)

Examples:
  %s log --oneline -n 10
  %s show HEAD
  %s status
  %s snapshot --json
  %s search "welcome" --json

Install: make cli   (builds bin/mind; mindbase <cmd> also works)
`, prog, prog, prog, prog, prog, prog, prog)
}
