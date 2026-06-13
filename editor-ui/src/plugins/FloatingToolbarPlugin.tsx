import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { mergeRegister } from '@lexical/utils'
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
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

type InlineFormat = Extract<TextFormatType, 'bold' | 'italic' | 'strikethrough' | 'code' | 'highlight'>

const TOOLBAR_ACTIONS: { format: InlineFormat; label: string; title: string }[] = [
  { format: 'bold', label: 'B', title: 'Bold' },
  { format: 'italic', label: 'I', title: 'Italic' },
  { format: 'strikethrough', label: 'S', title: 'Strikethrough' },
  { format: 'highlight', label: '==', title: 'Highlight' },
  { format: 'code', label: '</>', title: 'Inline code' },
]

export type BlockStyle = 'paragraph' | 'h1' | 'h2' | 'h3' | 'quote'

/** Apply a block style to the current selection. Must run inside editor.update(). */
export function $applyBlockStyle(style: BlockStyle) {
  const selection = $getSelection()
  if (style === 'paragraph') {
    $setBlocksType(selection, () => $createParagraphNode())
  } else if (style === 'quote') {
    $setBlocksType(selection, () => $createQuoteNode())
  } else {
    $setBlocksType(selection, () => $createHeadingNode(style))
  }
}

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
    highlight: false,
    code: false,
  })
  const [blockStyle, setBlockStyle] = useState<BlockStyle>('paragraph')
  const [isLink, setIsLink] = useState(false)
  const [linkEditing, setLinkEditing] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const reposition = useCallback(() => {
    let hasSelection = false
    let formats = { bold: false, italic: false, strikethrough: false, highlight: false, code: false }
    let style: BlockStyle = 'paragraph'
    let linked = false

    editor.getEditorState().read(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection) || selection.isCollapsed()) return
      hasSelection = true
      formats = {
        bold: selection.hasFormat('bold'),
        italic: selection.hasFormat('italic'),
        strikethrough: selection.hasFormat('strikethrough'),
        highlight: selection.hasFormat('highlight'),
        code: selection.hasFormat('code'),
      }
      const anchorNode = selection.anchor.getNode()
      const top = anchorNode.getTopLevelElement()
      if ($isHeadingNode(top)) {
        const tag = top.getTag()
        style = tag === 'h1' || tag === 'h2' || tag === 'h3' ? tag : 'paragraph'
      } else if ($isQuoteNode(top)) {
        style = 'quote'
      }
      const parent = anchorNode.getParent()
      linked = $isLinkNode(parent) || ($isElementNode(anchorNode) && $isLinkNode(anchorNode))
    })

    if (!hasSelection) {
      setVisible(false)
      setLinkEditing(false)
      postBridge({ type: 'selectionToolbar', visible: false })
      return
    }

    const rect = getSelectionRect(editor)
    if (!rect) {
      setVisible(false)
      setLinkEditing(false)
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
    setBlockStyle(style)
    setIsLink(linked)
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
      <div className="mb-floating-toolbar-row">
        <select
          className="mb-floating-toolbar-select"
          value={blockStyle}
          title="Text style"
          aria-label="Text style"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            const style = e.target.value as BlockStyle
            editor.update(() => $applyBlockStyle(style))
            requestAnimationFrame(reposition)
          }}
        >
          <option value="paragraph">Text</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="quote">Quote</option>
        </select>
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
        <button
          type="button"
          className={`mb-floating-toolbar-btn ${isLink ? 'is-active' : ''}`}
          title="Link"
          aria-label="Link"
          aria-pressed={isLink}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (isLink) {
              editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
              setLinkEditing(false)
            } else {
              setLinkUrl('')
              setLinkEditing(true)
            }
          }}
        >
          🔗
        </button>
      </div>
      {linkEditing && (
        <form
          className="mb-floating-toolbar-linkrow"
          onSubmit={(e) => {
            e.preventDefault()
            const url = linkUrl.trim()
            if (url) editor.dispatchCommand(TOGGLE_LINK_COMMAND, url)
            setLinkEditing(false)
          }}
        >
          <input
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            aria-label="Link URL"
          />
          <button type="submit">Set</button>
        </form>
      )}
    </div>,
    document.body,
  )
}
