import { createHeadlessEditor } from '@lexical/headless'
import { $convertFromMarkdownString } from '@lexical/markdown'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListItemNode, ListNode } from '@lexical/list'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { LinkNode } from '@lexical/link'
import { describe, expect, it } from 'vitest'
import { MINDBASE_TOKEN_NODES } from '../nodes/mindbaseTokenNodes'
import { ImageNode } from '../nodes/ImageNode'
import { FileCardNode } from '../nodes/FileCardNode'
import { MINDBASE_TRANSFORMERS } from '../markdown/mindbaseTransformers'
import { $collectOutline } from './OutlinePlugin'

function outlineOf(markdown: string) {
  const editor = createHeadlessEditor({
    namespace: 'test',
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, CodeHighlightNode, LinkNode, ImageNode, FileCardNode, ...MINDBASE_TOKEN_NODES],
    onError: (e) => { throw e },
  })
  editor.update(() => $convertFromMarkdownString(markdown, MINDBASE_TRANSFORMERS), { discrete: true })
  let result: ReturnType<typeof $collectOutline> = []
  editor.getEditorState().read(() => { result = $collectOutline() })
  return result
}

describe('$collectOutline', () => {
  it('collects H1-H3 in document order with levels and text', () => {
    const o = outlineOf('# One\n\ntext\n\n## Two\n\n### Three\n\n## Four')
    expect(o.map((h) => [h.level, h.text])).toEqual([[1, 'One'], [2, 'Two'], [3, 'Three'], [2, 'Four']])
    expect(new Set(o.map((h) => h.key)).size).toBe(4)
  })
  it('ignores H4+ and non-headings', () => {
    const o = outlineOf('#### Deep\n\nparagraph\n\n> quote\n\n## Kept')
    expect(o.map((h) => h.text)).toEqual(['Kept'])
  })
  it('returns empty for headingless documents', () => {
    expect(outlineOf('just text')).toEqual([])
  })
})
