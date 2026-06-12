import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { LinkNode } from '@lexical/link'
import { ListItemNode, ListNode } from '@lexical/list'
import { $convertFromMarkdownString } from '@lexical/markdown'
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { useEffect } from 'react'
import { BridgePlugin, registerEditorInstance } from './BridgePlugin'
import { MINDBASE_TRANSFORMERS } from './markdown/mindbaseTransformers'
import { MINDBASE_TOKEN_NODES } from './nodes/mindbaseTokenNodes'
import { SlashCommandPlugin } from './plugins/SlashCommandPlugin'
import { FloatingToolbarPlugin } from './plugins/FloatingToolbarPlugin'
import { ImmersivePlugin } from './plugins/ImmersivePlugin'
import type { SlashDocumentKind } from './slashCommands'
import { mindbaseTheme } from './theme'
import './editor.css'

function onError(error: Error) {
  console.error('[mindbase-editor]', error)
}

interface Props {
  initialMarkdown: string
  documentKind?: SlashDocumentKind
}

function EditorRefPlugin() {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    registerEditorInstance(editor)
  }, [editor])
  return null
}

export function EditorApp({ initialMarkdown, documentKind = 'note' }: Props) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'MindbaseEditor',
        theme: mindbaseTheme,
        onError,
        nodes: [
          HeadingNode,
          QuoteNode,
          ListNode,
          ListItemNode,
          CodeNode,
          CodeHighlightNode,
          LinkNode,
          ...MINDBASE_TOKEN_NODES,
        ],
        editorState: initialMarkdown
          ? () => {
              $convertFromMarkdownString(initialMarkdown, MINDBASE_TRANSFORMERS)
            }
          : undefined,
      }}
    >
      <div className="mindbase-immersive">
        <div className="mindbase-measure">
          <div className="mindbase-lexical-shell">
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="mindbase-lexical-input" aria-label="Note editor" spellCheck />
              }
              placeholder={<div className="mindbase-lexical-placeholder">Start writing…</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <CheckListPlugin />
        <LinkPlugin />
        <MarkdownShortcutPlugin transformers={MINDBASE_TRANSFORMERS} />
        <SlashCommandPlugin documentKind={documentKind} />
        <BridgePlugin />
        <ImmersivePlugin />
        <FloatingToolbarPlugin />
        <EditorRefPlugin />
      </div>
    </LexicalComposer>
  )
}
