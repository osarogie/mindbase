import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { mergeRegister } from '@lexical/utils'
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type LexicalEditor,
  type TextFormatType,
} from 'lexical'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { postBridge } from '../bridge'

type InlineFormat = Extract<TextFormatType, 'bold' | 'italic' | 'strikethrough' | 'code'>

const TOOLBAR_ACTIONS: { format: InlineFormat; label: string; title: string }[] = [
  { format: 'bold', label: 'B', title: 'Bold' },
  { format: 'italic', label: 'I', title: 'Italic' },
  { format: 'strikethrough', label: 'S', title: 'Strikethrough' },
  { format: 'code', label: '</>', title: 'Inline code' },
]

function getSelectionRect(editor: LexicalEditor): DOMRect | null {
  const root = editor.getRootElement()
  const native = window.getSelection()
  if (!root || !native || native.rangeCount === 0) return null
  const anchor = native.anchorNode
  if (!anchor || !root.contains(anchor)) return null
  const range = native.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return null
  return rect
}

export function FloatingToolbarPlugin() {
  const [editor] = useLexicalComposerContext()
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [activeFormats, setActiveFormats] = useState<Record<InlineFormat, boolean>>({
    bold: false,
    italic: false,
    strikethrough: false,
    code: false,
  })

  const reposition = useCallback(() => {
    let hasSelection = false
    let formats = { bold: false, italic: false, strikethrough: false, code: false }

    editor.getEditorState().read(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection) || selection.isCollapsed()) return
      hasSelection = true
      formats = {
        bold: selection.hasFormat('bold'),
        italic: selection.hasFormat('italic'),
        strikethrough: selection.hasFormat('strikethrough'),
        code: selection.hasFormat('code'),
      }
    })

    if (!hasSelection) {
      setVisible(false)
      postBridge({ type: 'selectionToolbar', visible: false })
      return
    }

    const rect = getSelectionRect(editor)
    if (!rect) {
      setVisible(false)
      postBridge({ type: 'selectionToolbar', visible: false })
      return
    }

    const toolbar = toolbarRef.current
    const toolbarWidth = toolbar?.offsetWidth ?? 0
    const margin = 10
    let left = rect.left + rect.width / 2
    const minLeft = margin + toolbarWidth / 2
    const maxLeft = window.innerWidth - margin - toolbarWidth / 2
    left = Math.min(Math.max(left, minLeft), maxLeft)

    setActiveFormats(formats)
    setPosition({
      top: rect.top - margin,
      left,
    })
    setVisible(true)
    postBridge({ type: 'selectionToolbar', visible: true })
  }, [editor])

  useEffect(() => {
    if (!visible) return
    requestAnimationFrame(reposition)
  }, [visible, reposition])

  useEffect(() => {
    const onScroll = () => {
      if (!visible) return
      reposition()
    }

    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', reposition)

    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', reposition)
    }
  }, [reposition, visible])

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(() => {
        requestAnimationFrame(reposition)
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          requestAnimationFrame(reposition)
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
    )
  }, [editor, reposition])

  const applyFormat = (format: InlineFormat) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
    requestAnimationFrame(reposition)
  }

  if (!visible || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={toolbarRef}
      className="mb-floating-toolbar"
      style={{ top: position.top, left: position.left }}
      role="toolbar"
      aria-label="Text formatting"
    >
      {TOOLBAR_ACTIONS.map(({ format, label, title }) => (
        <button
          key={format}
          type="button"
          className={`mb-floating-toolbar-btn ${activeFormats[format] ? 'is-active' : ''}`}
          title={title}
          aria-label={title}
          aria-pressed={activeFormats[format]}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyFormat(format)}
        >
          {label}
        </button>
      ))}
    </div>,
    document.body,
  )
}
