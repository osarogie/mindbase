import { createHeadlessEditor } from '@lexical/headless'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { LinkNode } from '@lexical/link'
import { ListItemNode, ListNode } from '@lexical/list'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { describe, expect, it } from 'vitest'
import { FileCardNode } from '../nodes/FileCardNode'
import { ImageNode } from '../nodes/ImageNode'
import { MINDBASE_TOKEN_NODES } from '../nodes/mindbaseTokenNodes'
import { MINDBASE_TRANSFORMERS } from './mindbaseTransformers'

/**
 * Guards against silent data loss on autosave. The rich editor round-trips a
 * note through markdown import → export on every change, so any construct that
 * does not survive that trip would be destroyed when the note is saved.
 *
 * These cases lock in the structures that are most at risk of being mangled:
 * GFM tables (no first-class table node — they survive as literal text),
 * database embeds (`[[db:...]]`), attachment embeds, fenced code, and the
 * Mindbase token syntaxes. Both a single trip and idempotency (two trips, as
 * happens across repeated autosaves) are checked.
 */
function roundtrip(md: string): string {
  const editor = createHeadlessEditor({
    namespace: 'roundtrip-test',
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeHighlightNode,
      LinkNode,
      ImageNode,
      FileCardNode,
      ...MINDBASE_TOKEN_NODES,
    ],
    onError: (e) => {
      throw e
    },
  })
  editor.update(() => $convertFromMarkdownString(md, MINDBASE_TRANSFORMERS), { discrete: true })
  let out = ''
  editor.getEditorState().read(() => {
    out = $convertToMarkdownString(MINDBASE_TRANSFORMERS)
  })
  return out
}

const PRESERVED: Record<string, string> = {
  'plain GFM table': `| Name | Age |\n| --- | --- |\n| Ada | 36 |\n| Bob | 42 |`,
  'aligned table': `| L | R |\n| :-- | --: |\n| a | b |`,
  'table with empty cell': `| A | B |\n| --- | --- |\n| 1 |  |`,
  'table with bold cell': `| Name | Role |\n| --- | --- |\n| **Ada** | dev |`,
  'table with tag cell': `| Task | Tag |\n| --- | --- |\n| Ship | #urgent |`,
  'table with wiki cell': `| Ref | Link |\n| --- | --- |\n| see | [[Other Note]] |`,
  'two adjacent tables': `| A |\n| --- |\n| 1 |\n\n| B |\n| --- |\n| 2 |`,
  'database embed': `Notes here.\n\n[[db:projects]]\n\nAfter.`,
  'database embed with label': `[[db:projects|My Projects]]`,
  'fenced code': '```js\nconst x = 1\n```',
  'fenced code containing pipes': '```\n| not | a | table |\n```',
  'wiki link': `See [[Other Note]] for details.`,
  'tag and mention': `Talk to @ada about #release today.`,
  'attachment image': `![](attachments/diagram.png)`,
}

describe('markdown autosave round-trip is lossless', () => {
  for (const [name, md] of Object.entries(PRESERVED)) {
    it(`preserves: ${name}`, () => {
      expect(roundtrip(md).trim()).toBe(md.trim())
    })

    it(`is idempotent across repeated saves: ${name}`, () => {
      const once = roundtrip(md)
      expect(roundtrip(once).trim()).toBe(once.trim())
    })
  }
})
