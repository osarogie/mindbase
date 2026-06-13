export type BridgeMessage =
  | { type: 'ready' }
  | { type: 'change'; markdown: string }
  | { type: 'sync'; markdown: string }
  | { type: 'height'; value: number }
  | { type: 'focus' }
  | { type: 'blur' }
  | { type: 'stats'; words: number; chars: number }
  | { type: 'selectionToolbar'; visible: boolean }
  | { type: 'attachment-uploaded'; path: string }
  | { type: 'attachment-error'; message: string }
  | { type: 'outline'; headings: { key: string; text: string; level: 1 | 2 | 3 }[] }

export function postBridge(msg: BridgeMessage) {
  const payload = JSON.stringify(msg)
  const w = window as Window & {
    ReactNativeWebView?: { postMessage: (data: string) => void }
    webkit?: { messageHandlers?: { mindbase?: { postMessage: (data: unknown) => void } } }
  }
  if (typeof w.dispatchEvent === 'function') {
    w.dispatchEvent(new CustomEvent('mindbase-editor', { detail: msg }))
  }
  if (w.ReactNativeWebView) {
    w.ReactNativeWebView.postMessage(payload)
    return
  }
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(payload, '*')
    return
  }
  if (w.webkit?.messageHandlers?.mindbase) {
    w.webkit.messageHandlers.mindbase.postMessage(payload)
  }
}

declare global {
  interface Window {
    __MINDBASE_INITIAL_MARKDOWN__?: string
    __MINDBASE_DOCUMENT_KIND__?: 'note' | 'database'
    mindbaseInsertBlock?: (key: string) => void
    mindbaseExecFormat?: (format: 'bold' | 'italic') => void
    mindbaseGetMarkdown?: () => string
    mindbaseSetMarkdown?: (markdown: string) => void
    mindbaseRunSlashCommand?: (id: string) => void
    mindbaseInsertAttachment?: (path: string) => void
    mindbaseScrollToHeading?: (key: string) => void
  }
}

export {}
