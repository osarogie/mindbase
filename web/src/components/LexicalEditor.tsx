import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { EditorApp } from '@mindbase/editor-ui/EditorApp'
import type { BridgeMessage } from '@mindbase/editor-ui/bridge'
import {
  attachmentMarkdownPath,
  resolveApiUrl,
  type AttachmentHost,
} from '@mindbase/editor-ui/attachments/host'
import { api } from '../api'
import '@mindbase/editor-ui/editor.css'

interface Props {
  value: string
  notePath: string
  onChange: (markdown: string) => void
}

/** Lexical rich-text editor — markdown in/out, shared with mobile/macOS WebView shell. */
export const LexicalEditor = memo(function LexicalEditor({ value, notePath, onChange }: Props) {
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

  return (
    <div className="lexical-editor-host">
      <EditorApp initialMarkdown={value} attachmentHost={attachmentHost} />
    </div>
  )
})
