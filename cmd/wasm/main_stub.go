//go:build !wasm

// This stub exists only so `go build ./...` / `go vet ./...` on the host don't
// fail with "build constraints exclude all Go files in cmd/wasm". The real
// entrypoint is main.go, compiled by TinyGo for the wasm target.
package main

func main() {}
