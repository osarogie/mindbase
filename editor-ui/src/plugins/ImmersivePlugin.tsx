import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getRoot } from 'lexical'
import { useEffect, useState } from 'react'
import { postBridge } from '../bridge'
import { countStats } from '../textStats'

function readPlainText(editor: ReturnType<typeof useLexicalComposerContext>[0]): string {
  let text = ''
  editor.getEditorState().read(() => {
    text = $getRoot().getTextContent()
  })
  return text
}

export function ImmersivePlugin() {
  const [editor] = useLexicalComposerContext()
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    const root = editor.getRootElement()
    if (!root) return

    const publishStats = () => {
      const next = countStats(readPlainText(editor))
      postBridge({ type: 'stats', words: next.words, chars: next.chars })
    }

    publishStats()

    const onFocusIn = () => {
      setFocused(true)
      document.body.classList.add('mb-immersive-focus')
      postBridge({ type: 'focus' })
    }

    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null
      if (next && root.contains(next)) return
      setFocused(false)
      document.body.classList.remove('mb-immersive-focus')
      postBridge({ type: 'blur' })
    }

    root.addEventListener('focusin', onFocusIn)
    root.addEventListener('focusout', onFocusOut)

    return () => {
      root.removeEventListener('focusin', onFocusIn)
      root.removeEventListener('focusout', onFocusOut)
      document.body.classList.remove('mb-immersive-focus')
    }
  }, [editor])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    return editor.registerUpdateListener(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const next = countStats(readPlainText(editor))
        postBridge({ type: 'stats', words: next.words, chars: next.chars })
      }, 200)
    })
  }, [editor])

  return (
    <>
      <div className="mb-immersive-vignette" aria-hidden="true" />
      <div className={`mb-immersive-rail ${focused ? 'mb-immersive-rail--focus' : ''}`} aria-hidden="true" />
    </>
  )
}
