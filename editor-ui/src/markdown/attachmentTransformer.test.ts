import { createHeadlessEditor } from '@lexical/headless'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import { $createParagraphNode, $getRoot, type ElementNode, type LexicalNode } from 'lexical'
import { describe, expect, it } from 'vitest'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListItemNode, ListNode } from '@lexical/list'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { LinkNode } from '@lexical/link'
import { MINDBASE_TOKEN_NODES } from '../nodes/mindbaseTokenNodes'
import { ImageNode, $isImageNode } from '../nodes/ImageNode'
import { FileCardNode, $isFileCardNode, $createFileCardNode } from '../nodes/FileCardNode'
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

  it('keeps empty-alt file embeds byte-stable without label enrichment', () => {
    // Regression (I2): enriching the label rewrote the user's markdown on save.
    const md = '![](welcome.attachments/My%20Doc.pdf)'
    const first = roundTrip(md)
    let label: string | undefined
    first.editor.getEditorState().read(() => {
      const card = first.nodes.find((n) => $isFileCardNode(n))
      expect(card).toBeDefined()
      label = (card as FileCardNode).getLabel()
    })
    expect(label).toBe('')
    expect(first.out).toBe(md)
    const second = roundTrip(first.out)
    expect(second.out).toBe(md)
  })

  it('round-trips titled images byte-identically as ImageNode', () => {
    // Regression (C2): the title made EMBED_IMPORT fail, so the LINK
    // transformer claimed it and rewrote the relative src to https://…
    const md = '![a](welcome.attachments/b.png "my title")'
    const first = roundTrip(md)
    expect(first.nodes.some((n) => $isImageNode(n))).toBe(true)
    expect(first.out).toBe(md)
    const second = roundTrip(first.out)
    expect(second.nodes.some((n) => $isImageNode(n))).toBe(true)
    expect(second.out).toBe(md)
  })

  it('keeps src stable across cycles when the label contains brackets', () => {
    // Regression (C1): a `]` in the label made the exported markdown
    // unparseable; on re-import the LINK transformer destroyed the path.
    const editor = createHeadlessEditor({
      namespace: 'test',
      nodes: [
        HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, CodeHighlightNode, LinkNode,
        ImageNode, FileCardNode, ...MINDBASE_TOKEN_NODES,
      ],
      onError: (e) => { throw e },
    })
    editor.update(() => {
      const p = $createParagraphNode()
      p.append($createFileCardNode('welcome.attachments/a%5Db.pdf', 'a]b.pdf'))
      $getRoot().append(p)
    }, { discrete: true })
    let md = ''
    editor.getEditorState().read(() => {
      md = $convertToMarkdownString(MINDBASE_TRANSFORMERS)
    })

    const first = roundTrip(md)
    let firstSrc: string | undefined
    first.editor.getEditorState().read(() => {
      const card = first.nodes.find((n) => $isFileCardNode(n))
      expect(card).toBeDefined()
      firstSrc = (card as FileCardNode).getSrc()
    })
    expect(firstSrc).toBe('welcome.attachments/a%5Db.pdf')

    const second = roundTrip(first.out)
    let secondSrc: string | undefined
    second.editor.getEditorState().read(() => {
      const card = second.nodes.find((n) => $isFileCardNode(n))
      expect(card).toBeDefined()
      secondSrc = (card as FileCardNode).getSrc()
    })
    expect(secondSrc).toBe('welcome.attachments/a%5Db.pdf')
    expect(second.out).toBe(first.out)
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
