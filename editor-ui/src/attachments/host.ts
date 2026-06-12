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

export function attachmentFilename(src: string): string {
  const clean = src.split(/[?#]/)[0]
  return clean.split('/').pop() ?? clean
}

/** "journal/x.md" + "photo.png" → "x.attachments/photo.png" (sibling-relative, portable). */
export function attachmentMarkdownPath(notePath: string, filename: string): string {
  const noteFile = notePath.split('/').pop() ?? notePath
  const base = noteFile.replace(/\.[^.]+$/, '')
  return `${base}.attachments/${filename}`
}

/** Resolve a markdown src (sibling-relative or legacy bare filename) to the server URL. */
export function resolveApiUrl(notePath: string, src: string): string {
  return `/api/files/${notePath}/${attachmentFilename(src)}`
}

export const AttachmentHostContext = createContext<AttachmentHost | null>(null)

/** Context host (web) falls back to a bridge-registered host (WebView shells). */
export function useAttachmentHost(): AttachmentHost | null {
  const fromContext = useContext(AttachmentHostContext)
  if (fromContext) return fromContext
  return (window as Window & { mindbaseAttachmentHost?: AttachmentHost }).mindbaseAttachmentHost ?? null
}

/** Absolute/external sources pass through; vault-relative sources go through the host. */
export function resolveSrc(host: AttachmentHost | null, src: string): string {
  if (/^(?:https?:)?\/\//.test(src) || src.startsWith('/') || src.startsWith('data:') || src.startsWith('blob:')) {
    return src
  }
  return host ? host.resolveUrl(src) : src
}
