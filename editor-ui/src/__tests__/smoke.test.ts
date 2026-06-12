import { createHeadlessEditor } from '@lexical/headless'
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { describe, expect, it } from 'vitest'

describe('headless lexical', () => {
  it('round-trips markdown', () => {
    const editor = createHeadlessEditor({ namespace: 'test', nodes: [HeadingNode, QuoteNode], onError: (e) => { throw e } })
    editor.update(() => $convertFromMarkdownString('# Hello', TRANSFORMERS), { discrete: true })
    let out = ''
    editor.getEditorState().read(() => { out = $convertToMarkdownString(TRANSFORMERS) })
    expect(out).toBe('# Hello')
  })
})
