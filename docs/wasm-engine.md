# WASM engine (TinyGo)

Compiles pure parts of the Go mindbase engine to WebAssembly so the web UI can
run them in the browser — no server round-trip, works offline.

## Why TinyGo

TinyGo produces much smaller wasm than `GOOS=js GOARCH=wasm` (the markdown engine
is ~533 KB vs several MB) and has no full Go GC. Trade-off: partial stdlib
support, so WASM-exported engine functions must stay dependency-light. The Go
markdown renderer (`internal/markdown`, which pulls in `html/template`, `regexp`,
and `internal/database`) does compile under TinyGo 0.41.

## Build

```bash
make wasm   # → web/public/mindbase.wasm + web/public/wasm_exec.js
```

Requires TinyGo: `brew install tinygo-org/tools/tinygo`. The artifacts are
gitignored (built like `web/dist`).

## Layout

- `cmd/wasm/main.go` (`//go:build wasm`) — registers globals via `syscall/js`:
  - `mindbaseRenderMarkdown(md string) string` — markdown → HTML
  - `mindbaseWasmReady` — boolean flag set once initialized
- `cmd/wasm/main_stub.go` (`//go:build !wasm`) — keeps `go build ./...` green on
  the host (no real entrypoint there).
- `web/src/lib/wasmEngine.ts` — `loadWasmEngine()` (lazy, one-time) and
  `renderMarkdownWasm()`; both degrade gracefully if the artifact isn't served.

Verified in Node: instantiating `mindbase.wasm` and calling
`mindbaseRenderMarkdown` returns correct HTML.

## Roadmap

1. Wire `MarkdownPreview` to prefer `renderMarkdownWasm()` (offline preview),
   falling back to the existing `/api/preview` path.
2. Expose more pure engine functions: CSV/database table → HTML, wiki-link
   resolution, frontmatter parsing.
3. Measure: only keep wasm where it beats the network round-trip in practice.

Not pursuing a Rust rewrite for now — see the `rust-engine-consideration` memo.
