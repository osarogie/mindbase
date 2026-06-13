import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $isHeadingNode } from '@lexical/rich-text'
import { $getRoot } from 'lexical'
import { useEffect } from 'react'
import { postBridge } from '../bridge'

export interface OutlineHeading {
  key: string
  text: string
  level: 1 | 2 | 3
}

/** Collect H1–H3 top-level headings in document order. Must run inside an editor state read/update. */
export function $collectOutline(): OutlineHeading[] {
  const headings: OutlineHeading[] = []
  for (const node of $getRoot().getChildren()) {
    if (!$isHeadingNode(node)) continue
    const tag = node.getTag()
    if (tag !== 'h1' && tag !== 'h2' && tag !== 'h3') continue
    headings.push({ key: node.getKey(), text: node.getTextContent(), level: Number(tag[1]) as 1 | 2 | 3 })
  }
  return headings
}

const OUTLINE_DEBOUNCE_MS = 280

export function OutlinePlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let last = ''
    const emit = () => {
      editor.getEditorState().read(() => {
        const headings = $collectOutline()
        const fingerprint = JSON.stringify(headings)
        if (fingerprint === last) return
        last = fingerprint
        postBridge({ type: 'outline', headings })
      })
    }
    emit()
    const unregister = editor.registerUpdateListener(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(emit, OUTLINE_DEBOUNCE_MS)
    })
    return () => {
      if (timer) clearTimeout(timer)
      unregister()
    }
  }, [editor])

  useEffect(() => {
    window.mindbaseScrollToHeading = (key: string) => {
      // Stale keys (heading deleted between debounce ticks) resolve to null — no-op per spec.
      const el = editor.getElementByKey(key)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    return () => {
      delete window.mindbaseScrollToHeading
    }
  }, [editor])

  return null
}
