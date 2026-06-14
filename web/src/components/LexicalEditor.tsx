import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { EditorApp } from '@mindbase/editor-ui/EditorApp'
import type { BridgeMessage } from '@mindbase/editor-ui/bridge'
import {
  attachmentMarkdownPath,
  resolveApiUrl,
  type AttachmentHost,
} from '@mindbase/editor-ui/attachments/host'
import type { LinkSource } from '@mindbase/editor-ui/links/host'
import { api } from '../api'
import { wikiTargetToPath, pathToWikiTarget } from '../lib/wikilink'
import '@mindbase/editor-ui/editor.css'

interface Props {
  value: string
  notePath: string
  onChange: (markdown: string) => void
}

/** Lexical rich-text editor — markdown in/out, shared with mobile/macOS WebView shell. */
export const LexicalEditor = memo(function LexicalEditor({ value, notePath, onChange }: Props) {
  const navigate = useNavigate()
  const hostRef = useRef<HTMLDivElement>(null)
  const lastEmitted = useRef(value)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const attachmentHost = useMemo<AttachmentHost>(
    () => ({
      upload: async (file) => {
        const entry = await api.attachments.upload(notePath, file)
        return { path: attachmentMarkdownPath(notePath, entry.name) }
      },
      resolveUrl: (path) => resolveApiUrl(notePath, path),
      list: async () => {
        const entries = await api.attachments.list(notePath)
        return entries.map((a) => ({ name: a.name, path: attachmentMarkdownPath(notePath, a.name) }))
      },
    }),
    [notePath],
  )

  // Candidates for the `[[` link picker: every other note, by path/title.
  const linkSource = useMemo<LinkSource>(
    () => async () => {
      const notes = await api.notes.list()
      return notes
        .filter((n) => n.path !== notePath)
        .map((n) => ({ target: pathToWikiTarget(n.path), label: n.title || pathToWikiTarget(n.path) }))
    },
    [notePath],
  )

  const handleBridge = useCallback((event: Event) => {
    const msg = (event as CustomEvent<BridgeMessage>).detail
    if (msg?.type === 'change' && typeof msg.markdown === 'string') {
      if (msg.markdown === lastEmitted.current) return
      lastEmitted.current = msg.markdown
      onChangeRef.current(msg.markdown)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('mindbase-editor', handleBridge)
    return () => window.removeEventListener('mindbase-editor', handleBridge)
  }, [handleBridge])

  useEffect(() => {
    if (value === lastEmitted.current) return
    lastEmitted.current = value
    window.mindbaseSetMarkdown?.(value)
  }, [value])

  // Clicking a [[wiki-link]] token navigates to that note (db: embeds excluded).
  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('.mb-wiki-link') as HTMLElement | null
      const target = link?.getAttribute('data-target')
      if (!target || target.startsWith('db:')) return
      e.preventDefault()
      navigate(`/notes/${wikiTargetToPath(target)}`)
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [navigate])

  return (
    <div className="lexical-editor-host" ref={hostRef}>
      <EditorApp initialMarkdown={value} attachmentHost={attachmentHost} linkSource={linkSource} />
    </div>
  )
})
