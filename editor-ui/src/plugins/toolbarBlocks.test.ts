import { createHeadlessEditor } from '@lexical/headless'
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { $getRoot, $createRangeSelection, $setSelection } from 'lexical'
import { describe, expect, it } from 'vitest'
import { $applyBlockStyle, type BlockStyle } from './FloatingToolbarPlugin'

function editorWith(markdown: string) {
  const editor = createHeadlessEditor({
    namespace: 'test',
    nodes: [HeadingNode, QuoteNode],
    onError: (e) => { throw e },
  })
  editor.update(() => $convertFromMarkdownString(markdown, TRANSFORMERS), { discrete: true })
  return editor
}

function applyAndExport(markdown: string, style: BlockStyle): string {
  const editor = editorWith(markdown)
  editor.update(() => {
    const first = $getRoot().getFirstChild()
    if (!first) throw new Error('empty doc')
    const sel = $createRangeSelection()
    sel.anchor.set(first.getKey(), 0, 'element')
    sel.focus.set(first.getKey(), 0, 'element')
    $setSelection(sel)
    $applyBlockStyle(style)
  }, { discrete: true })
  let out = ''
  editor.getEditorState().read(() => { out = $convertToMarkdownString(TRANSFORMERS) })
  return out
}

describe('$applyBlockStyle', () => {
  it('converts a paragraph to each heading level and quote', () => {
    expect(applyAndExport('hello', 'h1')).toBe('# hello')
    expect(applyAndExport('hello', 'h2')).toBe('## hello')
    expect(applyAndExport('hello', 'h3')).toBe('### hello')
    expect(applyAndExport('hello', 'quote')).toBe('> hello')
  })
  it('converts a heading back to a paragraph', () => {
    expect(applyAndExport('## hello', 'paragraph')).toBe('hello')
  })
})

describe('highlight markdown round-trip (library behavior we rely on)', () => {
  it('==x== survives import/export', () => {
    const editor = editorWith('==marked== text')
    let out = ''
    editor.getEditorState().read(() => { out = $convertToMarkdownString(TRANSFORMERS) })
    expect(out).toBe('==marked== text')
  })
})
