import { memo, useCallback, useEffect, useRef } from 'react'
import { EditorApp } from '@mindbase/editor-ui/EditorApp'
import type { BridgeMessage } from '@mindbase/editor-ui/bridge'
import '@mindbase/editor-ui/editor.css'

interface Props {
  value: string
  onChange: (markdown: string) => void
}

/** Lexical rich-text editor — markdown in/out, shared with mobile/macOS WebView shell. */
export const LexicalEditor = memo(function LexicalEditor({ value, onChange }: Props) {
  const lastEmitted = useRef(value)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

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
      <EditorApp initialMarkdown={value} />
    </div>
  )
})
