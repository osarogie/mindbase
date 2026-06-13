import { forwardRef, useImperativeHandle, useRef } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'

interface Props {
  value: string
  onChange: (value: string) => void
}

export interface MarkdownEditorHandle {
  insertText: (text: string) => void
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(function MarkdownEditor(
  { value, onChange },
  ref,
) {
  const cmRef = useRef<ReactCodeMirrorRef>(null)

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      const view = cmRef.current?.view
      if (!view) return
      const pos = view.state.selection.main.head
      view.dispatch({ changes: { from: pos, insert: text }, selection: { anchor: pos + text.length } })
      view.focus()
    },
  }))

  return (
    <CodeMirror
      ref={cmRef}
      value={value}
      height="100%"
      extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
      onChange={onChange}
      className="markdown-editor"
    />
  )
})
