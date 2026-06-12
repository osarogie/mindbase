import { useCallback, useEffect, useRef, useState } from 'react'
import { Save, Trash2, Upload, Eye, Edit3, FileCode2 } from 'lucide-react'
import { api, AttachmentEntry, connectWS } from '../api'
import { LexicalEditor } from './LexicalEditor'
import { MarkdownEditor } from './MarkdownEditor'
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
  const fileRef = useRef<HTMLInputElement>(null)

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
    setStatus('Saving…')
    try {
      await api.notes.save(path, content)
      setSaved(content)
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

  const upload = async (file: File) => {
    await api.attachments.upload(path, file)
    const files = await api.attachments.list(path)
    setAttachments(files)
  }

  const dirty = content !== saved

  return (
    <div className="note-view">
      <header className="content-header">
        <h2>{path.replace(/\.md$/, '').split('/').pop()}</h2>
        <div className="header-actions">
          {status && <span className="status">{status}</span>}
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
          <button type="button" className="primary" onClick={save} disabled={!dirty}>
            <Save size={16} /> Save
          </button>
          <button type="button" onClick={remove} className="danger">
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <div className={`editor-pane mode-${mode}`}>
        {(mode === 'rich' || mode === 'split') && (
          <LexicalEditor value={content} onChange={setContent} />
        )}
        {mode === 'markdown' && <MarkdownEditor value={content} onChange={setContent} />}
        {(mode === 'preview' || mode === 'split') && (
          <MarkdownPreview content={content} notePath={path} />
        )}
      </div>

      <section className="attachments-panel">
        <h3>Attachments</h3>
        <div className="attachment-actions">
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload(f)
              e.target.value = ''
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Upload
          </button>
        </div>
        <ul>
          {attachments.map((a) => (
            <li key={a.name}>
              <a href={api.attachments.url(path, a.name)} target="_blank" rel="noreferrer">
                {a.name}
              </a>
              <small>{(a.size / 1024).toFixed(1)} KB</small>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
