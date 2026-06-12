import { createRoot } from 'react-dom/client'
import { EditorApp } from './EditorApp'
import type { SlashDocumentKind } from './slashCommands'

const initialMarkdown = window.__MINDBASE_INITIAL_MARKDOWN__ ?? ''
const documentKind = (window.__MINDBASE_DOCUMENT_KIND__ ?? 'note') as SlashDocumentKind
const mount = document.getElementById('lexical-root')

if (mount) {
  createRoot(mount).render(<EditorApp initialMarkdown={initialMarkdown} documentKind={documentKind} />)
}
