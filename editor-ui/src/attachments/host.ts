import { createContext, useContext } from 'react'

export interface AttachmentInfo {
  name: string
  /** Markdown-relative path, e.g. "welcome.attachments/photo.png" */
  path: string
}

/** Host adapter supplied by the embedding app (web NoteView, future WebView shells). */
export interface AttachmentHost {
  upload(file: File): Promise<{ path: string }>
  resolveUrl(path: string): string
  list(): Promise<AttachmentInfo[]>
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'])

export function isImagePath(path: string): boolean {
  const clean = path.split(/[?#]/)[0]
  const dot = clean.lastIndexOf('.')
  if (dot < 0) return false
  return IMAGE_EXTENSIONS.has(clean.slice(dot + 1).toLowerCase())
}

/**
 * Extract the on-disk filename from a markdown src value.
 *
 * Strips the directory prefix and any `?query`/`#hash` suffix, then
 * percent-decodes the result so callers receive the human-readable filename
 * (e.g. `"Shot 1.png"` rather than `"Shot%201.png"`).
 *
 * Returns the raw segment unchanged if `decodeURIComponent` throws (e.g.
 * a literal lone `%` that is not valid percent-encoding).
 */
export function attachmentFilename(src: string): string {
  const clean = src.split(/[?#]/)[0]
  const segment = clean.split('/').pop() ?? clean
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * Build the sibling-relative markdown path for a new attachment.
 *
 * The filename segment is percent-encoded with `encodeURIComponent` so that
 * the resulting link target is valid CommonMark even when the filename
 * contains spaces or other special characters.
 *
 * Example: `attachmentMarkdownPath('welcome.md', 'Shot 1.png')`
 *          → `'welcome.attachments/Shot%201.png'`
 */
export function attachmentMarkdownPath(notePath: string, filename: string): string {
  const noteFile = notePath.split('/').pop() ?? notePath
  const base = noteFile.replace(/\.[^.]+$/, '')
  return `${base}.attachments/${encodeURIComponent(filename)}`
}

/**
 * Resolve a markdown src (sibling-relative or legacy bare filename) to the
 * server API URL.
 *
 * The filename segment in the returned URL is always percent-encoded exactly
 * once: `attachmentFilename` decodes whatever encoding the `src` carries, and
 * `encodeURIComponent` re-encodes it uniformly.
 *
 * Example: `resolveApiUrl('welcome.md', 'welcome.attachments/Shot%201.png')`
 *          → `'/api/files/welcome.md/Shot%201.png'`
 */
export function resolveApiUrl(notePath: string, src: string): string {
  return `/api/files/${notePath}/${encodeURIComponent(attachmentFilename(src))}`
}

export const AttachmentHostContext = createContext<AttachmentHost | null>(null)

declare global {
  interface Window {
    mindbaseAttachmentHost?: AttachmentHost
  }
}

/** Context host (web) falls back to a bridge-registered host (WebView shells). */
export function useAttachmentHost(): AttachmentHost | null {
  const fromContext = useContext(AttachmentHostContext)
  if (fromContext) return fromContext
  return window.mindbaseAttachmentHost ?? null
}

/** Absolute/external sources pass through; vault-relative sources go through the host. */
export function resolveSrc(host: AttachmentHost | null, src: string): string {
  if (/^(?:https?:)?\/\//.test(src) || src.startsWith('/') || src.startsWith('data:') || src.startsWith('blob:')) {
    return src
  }
  return host ? host.resolveUrl(src) : src
}
