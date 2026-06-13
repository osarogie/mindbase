//go:build wasm

// Command wasm exposes pure mindbase engine functions to the browser via
// WebAssembly, built with TinyGo (see `make wasm`). It lets the web UI render
// markdown previews offline using the same Go engine as the server, with no
// round-trip. The real entrypoint is gated to wasm builds; main_stub.go keeps
// `go build ./...` happy on the host.
package main

import (
	"syscall/js"

	"github.com/osarogie/mindbase/internal/markdown"
)

// renderMarkdown(md string) string — render markdown to HTML.
func renderMarkdown(_ js.Value, args []js.Value) any {
	if len(args) < 1 {
		return ""
	}
	html := markdown.Render(args[0].String(), markdown.RenderOptions{})
	return string(html)
}

func main() {
	js.Global().Set("mindbaseRenderMarkdown", js.FuncOf(renderMarkdown))
	js.Global().Set("mindbaseWasmReady", js.ValueOf(true))
	select {} // keep the instance alive so exported funcs stay callable
}
