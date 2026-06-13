import { useCallback, useEffect, useRef, useState } from 'react'
import { Save, Trash2, Eye, Edit3, FileCode2, MessageSquare } from 'lucide-react'
import { attachmentMarkdownPath } from '@mindbase/editor-ui/attachments/host'
import type { BridgeMessage } from '@mindbase/editor-ui/bridge'
import { api, AttachmentEntry, connectWS } from '../api'
import { CommentsRail } from './CommentsRail'
import { EditorFooter } from './EditorFooter'
import { LexicalEditor } from './LexicalEditor'
import { MarkdownEditor, type MarkdownEditorHandle } from './MarkdownEditor'
import { MarkdownPreview } from './MarkdownPreview'

type EditorMode = 'rich' | 'markdown' | 'preview' | 'split'

interface Props {
  path: string
  onDeleted: () => void
}

export function NoteView({ path, onDeleted }: Props) {
  const [content, setContent] = useState('')
  const [saved, setSaved] = useState('')
  const [mode, setMode] = useState<EditorMode>('rich')
  const [attachments, setAttachments] = useState<AttachmentEntry[]>([])
  const [status, setStatus] = useState('')
  const [commentsOpen, setCommentsOpen] = useState(false)
  const mdRef = useRef<MarkdownEditorHandle>(null)

  const load = useCallback(async () => {
    const note = await api.notes.get(path)
    setContent(note.content)
    setSaved(note.content)
    const files = await api.attachments.list(path)
    setAttachments(files)
  }, [path])

  useEffect(() => {
    load().catch((e) => setStatus(String(e)))
  }, [load])

  useEffect(() => {
    const ws = connectWS((type, p) => {
      if (type === 'note' && p.endsWith(path)) load()
    })
    return () => ws.close()
  }, [path, load])

  const save = async () => {
    // Rich/split modes emit their markdown through a 280ms-debounced bridge
    // event, so `content` can lag a keystroke behind. Pull the live markdown
    // straight from the editor to avoid persisting stale text.
    let current = content
    if (mode === 'rich' || mode === 'split') {
      const live = window.mindbaseGetMarkdown?.()
      if (typeof live === 'string') current = live
    }
    setStatus('Saving…')
    try {
      await api.notes.save(path, current)
      setContent(current)
      setSaved(current)
      setStatus('Saved')
      setTimeout(() => setStatus(''), 1500)
    } catch (e) {
      setStatus(String(e))
    }
  }

  const remove = async () => {
    if (!confirm(`Delete ${path}?`)) return
    await api.notes.delete(path)
    onDeleted()
  }

  useEffect(() => {
    const onBridge = (event: Event) => {
      const msg = (event as CustomEvent<BridgeMessage>).detail
      if (msg?.type === 'attachment-uploaded') {
        api.attachments.list(path).then(setAttachments).catch(() => {})
      }
    }
    window.addEventListener('mindbase-editor', onBridge)
    return () => window.removeEventListener('mindbase-editor', onBridge)
  }, [path])

  const insertAttachment = (name: string) => {
    const mdPath = attachmentMarkdownPath(path, name)
    if (mode === 'markdown') {
      mdRef.current?.insertText(`![](${mdPath})`)
      return
    }
    // rich + split both render LexicalEditor — insert via its bridge
    window.mindbaseInsertAttachment?.(mdPath)
  }

  const upload = async (file: File) => {
    await api.attachments.upload(path, file)
    const files = await api.attachments.list(path)
    setAttachments(files)
  }

  const deleteAttachment = async (name: string) => {
    if (!confirm(`Delete attachment "${name}"? This cannot be undone.`)) return
    try {
      await api.attachments.delete(path, name)
      setAttachments(await api.attachments.list(path))
    } catch (e) {
      setStatus(String(e))
    }
  }

  const dirty = content !== saved

  return (
    <div className="note-view">
      <header className="content-header">
        <h2>{path.replace(/\.md$/, '').split('/').pop()}</h2>
        <div className="header-actions">
          <div className="mode-toggle">
            <button type="button" className={mode === 'rich' ? 'active' : ''} onClick={() => setMode('rich')} title="Rich text">
              <Edit3 size={16} />
            </button>
            <button type="button" className={mode === 'markdown' ? 'active' : ''} onClick={() => setMode('markdown')} title="Markdown source">
              <FileCode2 size={16} />
            </button>
            <button type="button" className={mode === 'split' ? 'active' : ''} onClick={() => setMode('split')} title="Split">
              ⬌
            </button>
            <button type="button" className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')} title="Preview">
              <Eye size={16} />
            </button>
          </div>
          <button
            type="button"
            className={`icon-btn ${commentsOpen ? 'is-active' : ''}`}
            title="Comments"
            aria-label="Comments"
            onClick={() => setCommentsOpen((v) => !v)}
          >
            <MessageSquare size={16} />
          </button>
          <button type="button" className="primary" onClick={save} disabled={!dirty}>
            <Save size={16} /> Save
          </button>
          <button type="button" onClick={remove} className="danger">
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <div className="note-body">
        <div className={`editor-pane mode-${mode}`}>
          {(mode === 'rich' || mode === 'split') && (
            <LexicalEditor value={content} notePath={path} onChange={setContent} />
          )}
          {mode === 'markdown' && <MarkdownEditor ref={mdRef} value={content} onChange={setContent} />}
          {(mode === 'preview' || mode === 'split') && (
            <MarkdownPreview content={content} notePath={path} />
          )}
        </div>
        <CommentsRail open={commentsOpen} onClose={() => setCommentsOpen(false)} />
      </div>

      <EditorFooter
        key={path}
        notePath={path}
        mode={mode}
        content={content}
        attachments={attachments}
        saveState={status || (dirty ? 'Unsaved' : 'Saved')}
        onInsert={insertAttachment}
        onUpload={(f) => void upload(f)}
        onDelete={(name) => void deleteAttachment(name)}
      />
    </div>
  )
}
