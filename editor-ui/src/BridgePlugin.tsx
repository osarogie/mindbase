import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { useEffect, useRef } from 'react'
import {
  applyInlineFormat,
  insertEditorBlock,
  readMarkdown,
  runSlashCommand,
  writeMarkdown,
} from './editorCommands'
import { postBridge } from './bridge'
import type { SlashCommand } from './slashCommands'
import { slashCommandsFor } from './slashCommands'

function notifyHeight() {
  const root = document.getElementById('lexical-root')
  if (!root) return
  const h = Math.max(root.scrollHeight, document.documentElement.scrollHeight, 320)
  postBridge({ type: 'height', value: h })
}

export function BridgePlugin() {
  const [editor] = useLexicalComposerContext()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastMarkdownRef = useRef('')

  useEffect(() => {
    const kind = window.__MINDBASE_DOCUMENT_KIND__ ?? 'note'

    window.mindbaseInsertBlock = (key: string) => insertEditorBlock(editor, key)
    window.mindbaseExecFormat = (format: 'bold' | 'italic') => applyInlineFormat(editor, format)
    window.mindbaseGetMarkdown = () => readMarkdown(editor)
    window.mindbaseSetMarkdown = (markdown: string) => writeMarkdown(editor, markdown)
    window.mindbaseRunSlashCommand = (id: string) => {
      const cmd = slashCommandsFor(kind).find((item) => item.id === id)
      if (cmd) runSlashCommand(editor, cmd)
    }
    ;(window as Window & { mindbaseFlushSync?: () => void }).mindbaseFlushSync = () => {
      postBridge({ type: 'sync', markdown: readMarkdown(editor) })
    }

    postBridge({ type: 'ready' })
    notifyHeight()

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => notifyHeight())
        : null
    const root = document.getElementById('lexical-root')
    if (root && ro) ro.observe(root)

    return () => {
      ro?.disconnect()
      delete window.mindbaseInsertBlock
      delete window.mindbaseExecFormat
      delete window.mindbaseGetMarkdown
      delete window.mindbaseSetMarkdown
      delete window.mindbaseRunSlashCommand
      delete (window as Window & { mindbaseFlushSync?: () => void }).mindbaseFlushSync
    }
  }, [editor])

  return (
    <OnChangePlugin
      ignoreSelectionChange
      onChange={() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          const markdown = readMarkdown(editor)
          if (markdown === lastMarkdownRef.current) return
          lastMarkdownRef.current = markdown
          postBridge({ type: 'change', markdown })
          notifyHeight()
        }, 280)
      }}
    />
  )
}

export function registerEditorInstance(editor: import('lexical').LexicalEditor) {
  ;(window as unknown as { __mindbaseEditor?: import('lexical').LexicalEditor }).__mindbaseEditor = editor
}

export type { SlashCommand }
