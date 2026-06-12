//go:build tools

// Package tools pins development tool versions via go.mod (tool directive).
// Install/sync: go mod download
// Run:        go tool air | go tool templ
package tools

import (
	_ "github.com/a-h/templ/cmd/templ"
	_ "github.com/air-verse/air"
)
