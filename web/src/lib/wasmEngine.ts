// Loads the TinyGo-compiled mindbase engine (built via `make wasm` →
// /mindbase.wasm + /wasm_exec.js) so the web UI can render markdown previews
// offline with the same Go engine as the server. Degrades gracefully: if the
// wasm artifact isn't built/served, callers fall back to their normal path.

declare global {
  interface Window {
    Go?: new () => { importObject: WebAssembly.Imports; run: (i: WebAssembly.Instance) => void }
    mindbaseRenderMarkdown?: (md: string) => string
    mindbaseWasmReady?: boolean
  }
}

let readyPromise: Promise<boolean> | null = null

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`failed to load ${src}`))
    document.head.appendChild(s)
  })
}

/** Loads + instantiates the wasm engine once. Resolves to whether it's ready. */
export function loadWasmEngine(): Promise<boolean> {
  if (readyPromise) return readyPromise
  readyPromise = (async () => {
    try {
      if (!window.Go) await loadScript('/wasm_exec.js')
      if (!window.Go) return false
      const go = new window.Go()
      // arrayBuffer (not instantiateStreaming) so a missing application/wasm
      // MIME type can't break instantiation.
      const bytes = await (await fetch('/mindbase.wasm')).arrayBuffer()
      const { instance } = await WebAssembly.instantiate(bytes, go.importObject)
      go.run(instance)
      return window.mindbaseWasmReady === true
    } catch {
      return false
    }
  })()
  return readyPromise
}

/** Render markdown to HTML via the wasm engine, or null if it isn't loaded. */
export function renderMarkdownWasm(md: string): string | null {
  return typeof window.mindbaseRenderMarkdown === 'function' ? window.mindbaseRenderMarkdown(md) : null
}
