package connectors

import "testing"

func TestDefaultConfigSourceSink(t *testing.T) {
	cfg := DefaultConfig()
	if cfg.Source != ConnectorNotion {
		t.Fatalf("source = %q, want notion", cfg.Source)
	}
	if cfg.Sink != ConnectorGDrive {
		t.Fatalf("sink = %q, want gdrive", cfg.Sink)
	}
}

func TestNormalizeSourceSinkDefaults(t *testing.T) {
	cfg := normalizeSourceSink(Config{})
	if cfg.Source != ConnectorNotion || cfg.Sink != ConnectorGDrive {
		t.Fatalf("got source=%q sink=%q", cfg.Source, cfg.Sink)
	}
}

func TestValidateSourceSink(t *testing.T) {
	if err := ValidateSourceSink(Config{Source: ConnectorNotion, Sink: ConnectorGDrive}); err != nil {
		t.Fatal(err)
	}
	if err := ValidateSourceSink(Config{Source: ConnectorNotion, Sink: ConnectorNotion}); err == nil {
		t.Fatal("expected error when source and sink match")
	}
	if err := ValidateSourceSink(Config{Source: "dropbox", Sink: ConnectorGDrive}); err == nil {
		t.Fatal("expected error for unknown source")
	}
}

func TestConnectorEnabledForRole(t *testing.T) {
	cfg := Config{Source: ConnectorNotion, Sink: ConnectorGDrive}
	if !cfg.ConnectorEnabled(ConnectorNotion) || !cfg.ConnectorEnabled(ConnectorGDrive) {
		t.Fatal("both connectors should be enabled for default roles")
	}
	if cfg.ConnectorEnabled("other") {
		t.Fatal("unknown connector should not be enabled")
	}
}
