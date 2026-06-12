package cli

import "testing"

func TestIsCommand(t *testing.T) {
	if !IsCommand("log") {
		t.Fatal("log should be command")
	}
	if IsCommand("-vault") {
		t.Fatal("-vault is a flag, not command")
	}
	if IsCommand("serve") {
		t.Fatal("serve is not a cli command")
	}
}

func TestParseLeadingFlags(t *testing.T) {
	args, cfg := parseLeadingFlags([]string{"--json", "--vault", "/tmp/v", "log"}, defaultConfig())
	if !cfg.JSON || cfg.Vault == "" {
		t.Fatalf("cfg=%+v", cfg)
	}
	if len(args) != 1 || args[0] != "log" {
		t.Fatalf("args=%v", args)
	}
}
