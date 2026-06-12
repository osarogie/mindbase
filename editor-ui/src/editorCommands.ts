import { $createCodeNode } from '@lexical/code'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import { INSERT_CHECK_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list'
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text'
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  type LexicalEditor,
} from 'lexical'
import { MINDBASE_TRANSFORMERS } from './markdown/mindbaseTransformers'
import type { SlashCommand } from './slashCommands'

export function readMarkdown(editor: LexicalEditor): string {
  let markdown = ''
  editor.getEditorState().read(() => {
    markdown = $convertToMarkdownString(MINDBASE_TRANSFORMERS)
  })
  return markdown
}

export function writeMarkdown(editor: LexicalEditor, markdown: string) {
  editor.update(() => {
    $convertFromMarkdownString(markdown, MINDBASE_TRANSFORMERS)
  })
}

function ensureRangeSelection(_editor: LexicalEditor) {
  const selection = $getSelection()
  if ($isRangeSelection(selection)) return selection
  const root = $getRoot()
  root.selectEnd()
  const next = $getSelection()
  return $isRangeSelection(next) ? next : null
}

export function insertEditorBlock(editor: LexicalEditor, key: string) {
  editor.focus()
  editor.update(() => {
    const selection = ensureRangeSelection(editor)
    if (!selection) return

    switch (key) {
      case 'h1':
      case 'h2':
      case 'h3':
        selection.insertNodes([$createHeadingNode(key)])
        break
      case 'list':
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
        break
      case 'ordered':
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
        break
      case 'task':
        editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)
        break
      case 'quote':
        selection.insertNodes([$createQuoteNode()])
        break
      case 'code':
        selection.insertNodes([$createCodeNode()])
        break
      default:
        break
    }
  })
}

export function insertPlainText(editor: LexicalEditor, text: string) {
  editor.focus()
  editor.update(() => {
    const selection = ensureRangeSelection(editor)
    if (!selection) return
    const trimmed = text.replace(/^\n/, '')
    if (trimmed.includes('\n') || trimmed.startsWith('- ') || trimmed.startsWith('>') || trimmed.startsWith('|')) {
      const paragraph = $createParagraphNode()
      paragraph.append($createTextNode(trimmed))
      selection.insertNodes([paragraph])
      return
    }
    selection.insertText(trimmed)
  })
}

export function runSlashCommand(editor: LexicalEditor, command: SlashCommand) {
  if (command.block) {
    insertEditorBlock(editor, command.block)
    return
  }
  if (command.insert) {
    insertPlainText(editor, command.insert)
  }
}

export function applyInlineFormat(editor: LexicalEditor, format: 'bold' | 'italic') {
  editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
}
