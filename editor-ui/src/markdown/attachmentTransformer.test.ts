import { createHeadlessEditor } from '@lexical/headless'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import { $getRoot, type ElementNode, type LexicalNode } from 'lexical'
import { describe, expect, it } from 'vitest'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListItemNode, ListNode } from '@lexical/list'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { LinkNode } from '@lexical/link'
import { MINDBASE_TOKEN_NODES } from '../nodes/mindbaseTokenNodes'
import { ImageNode, $isImageNode } from '../nodes/ImageNode'
import { FileCardNode, $isFileCardNode } from '../nodes/FileCardNode'
import { MINDBASE_TRANSFORMERS } from './mindbaseTransformers'

import type { LexicalEditor } from 'lexical'

function roundTrip(markdown: string): { out: string; nodes: LexicalNode[]; editor: LexicalEditor } {
  const editor = createHeadlessEditor({
    namespace: 'test',
    nodes: [
      HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, CodeHighlightNode, LinkNode,
      ImageNode, FileCardNode, ...MINDBASE_TOKEN_NODES,
    ],
    onError: (e) => { throw e },
  })
  editor.update(() => $convertFromMarkdownString(markdown, MINDBASE_TRANSFORMERS), { discrete: true })
  let out = ''
  const nodes: LexicalNode[] = []
  editor.getEditorState().read(() => {
    out = $convertToMarkdownString(MINDBASE_TRANSFORMERS)
    for (const block of $getRoot().getChildren()) {
      const el = block as ElementNode
      if (typeof el.getChildren === 'function') nodes.push(...el.getChildren())
    }
  })
  return { out, nodes, editor }
}

describe('attachment embed transformer', () => {
  it('imports image paths as ImageNode and round-trips losslessly', () => {
    const md = '![pic](welcome.attachments/photo.png)'
    const { out, nodes } = roundTrip(md)
    expect(nodes.some((n) => $isImageNode(n))).toBe(true)
    expect(out).toBe(md)
  })

  it('round-trips percent-encoded filenames', () => {
    const md = '![shot](welcome.attachments/Shot%201.png)'
    const { out, nodes } = roundTrip(md)
    expect(nodes.some((n) => $isImageNode(n))).toBe(true)
    expect(out).toBe(md)
  })

  it('imports non-image paths as FileCardNode and round-trips losslessly', () => {
    const md = '![report.pdf](welcome.attachments/report.pdf)'
    const { out, nodes } = roundTrip(md)
    expect(nodes.some((n) => $isFileCardNode(n))).toBe(true)
    expect(out).toBe(md)
  })

  it('labels a file card by decoded filename when alt is empty', () => {
    const { nodes, editor } = roundTrip('![](welcome.attachments/My%20Doc.pdf)')
    let label: string | undefined
    editor.getEditorState().read(() => {
      const card = nodes.find((n) => $isFileCardNode(n))
      expect(card).toBeDefined()
      label = (card as FileCardNode).getLabel()
    })
    expect(label).toBe('My Doc.pdf')
  })

  it('reads legacy bare filenames', () => {
    const { nodes } = roundTrip('![](photo.png)')
    expect(nodes.some((n) => $isImageNode(n))).toBe(true)
  })

  it('renders remote images as ImageNode', () => {
    const md = '![logo](https://example.com/logo.png)'
    const { out, nodes } = roundTrip(md)
    expect(nodes.some((n) => $isImageNode(n))).toBe(true)
    expect(out).toBe(md)
  })

  it('does not break plain links', () => {
    const md = '[label](https://example.com)'
    const { out } = roundTrip(md)
    expect(out).toBe(md)
  })

  it('handles an embed surrounded by text', () => {
    const md = 'before ![p](a.png) after'
    const { out, nodes } = roundTrip(md)
    expect(nodes.some((n) => $isImageNode(n))).toBe(true)
    expect(out).toBe(md)
  })
})
