import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $isListItemNode, $isListNode } from '@lexical/list'
import { TextNode, type LexicalEditor } from 'lexical'
import { useEffect } from 'react'

// Leading task marker at the start of a list item: `[]`, `[ ]`, or `[x]` + a space.
const TASK_MARKER = /^\[( |x)?\]\s/i

/**
 * Promotes a bullet/number list item to a checklist item when its text begins
 * with a task marker. Returns the unregister function.
 *
 * The built-in CHECK_LIST markdown transformer only fires for paragraphs that
 * are direct children of the root. Typing `- ` converts the line to a bullet
 * list first, so by the time `[]` is typed the text lives inside a ListItemNode
 * and the transformer can never match. This watches list-item text for the task
 * marker and promotes the list to a check list, stripping the marker.
 */
export function registerCheckListShortcut(editor: LexicalEditor): () => void {
  return editor.registerNodeTransform(TextNode, (node) => {
    const item = node.getParent()
    if (!$isListItemNode(item) || item.getFirstChild() !== node) return

    const list = item.getParent()
    if (!$isListNode(list) || list.getListType() === 'check') return

    const text = node.getTextContent()
    const match = text.match(TASK_MARKER)
    if (!match) return

    const checked = match[1]?.toLowerCase() === 'x'
    node.setTextContent(text.slice(match[0].length))
    list.setListType('check')
    item.setChecked(checked)
  })
}

/** Lets `- [] `, `- [ ] `, and `- [x] ` become checklist items. */
export function CheckListShortcutPlugin() {
  const [editor] = useLexicalComposerContext()
  useEffect(() => registerCheckListShortcut(editor), [editor])
  return null
}
