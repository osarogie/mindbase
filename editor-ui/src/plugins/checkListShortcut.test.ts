import { createHeadlessEditor } from '@lexical/headless'
import { $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown'
import {
  $createListItemNode,
  $createListNode,
  $isListNode,
  ListItemNode,
  ListNode,
} from '@lexical/list'
import { $createTextNode, $getRoot } from 'lexical'
import { describe, expect, it } from 'vitest'
import { registerCheckListShortcut } from './CheckListShortcutPlugin'

function makeEditor() {
  const editor = createHeadlessEditor({
    namespace: 'test',
    nodes: [ListNode, ListItemNode],
    onError: (e) => {
      throw e
    },
  })
  registerCheckListShortcut(editor)
  return editor
}

/** Builds a bullet list whose single item text is `initial`, lets transforms run, returns markdown. */
function runWith(initial: string): { markdown: string; checked: boolean | undefined } {
  const editor = makeEditor()
  editor.update(
    () => {
      const list = $createListNode('bullet')
      const item = $createListItemNode()
      item.append($createTextNode(initial))
      list.append(item)
      $getRoot().clear().append(list)
    },
    { discrete: true },
  )
  let markdown = ''
  let checked: boolean | undefined
  editor.getEditorState().read(() => {
    markdown = $convertToMarkdownString(TRANSFORMERS)
    const list = $getRoot().getFirstChild()
    if ($isListNode(list)) {
      const item = list.getFirstChild()
      checked = item && 'getChecked' in item ? (item as ListItemNode).getChecked() : undefined
    }
  })
  return { markdown, checked }
}

describe('registerCheckListShortcut', () => {
  it('converts `[] ` to an unchecked task', () => {
    expect(runWith('[] buy milk')).toEqual({ markdown: '- [ ] buy milk', checked: false })
  })

  it('converts `[ ] ` to an unchecked task', () => {
    expect(runWith('[ ] buy milk')).toEqual({ markdown: '- [ ] buy milk', checked: false })
  })

  it('converts `[x] ` to a checked task', () => {
    expect(runWith('[x] done')).toEqual({ markdown: '- [x] done', checked: true })
  })

  it('leaves a plain bullet untouched', () => {
    expect(runWith('not a task')).toEqual({ markdown: '- not a task', checked: undefined })
  })

  it('ignores a bracket that is not a leading marker', () => {
    expect(runWith('see [1] reference')).toEqual({ markdown: '- see [1] reference', checked: undefined })
  })
})
