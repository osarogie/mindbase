import { useCallback, useEffect, useRef, useState } from 'react'
import { Save, Trash2, Eye, Edit3, FileCode2, MessageSquare, Columns2, ListTree, History, Link2 } from 'lucide-react'
import { attachmentMarkdownPath } from '@mindbase/editor-ui/attachments/host'
import type { BridgeMessage } from '@mindbase/editor-ui/bridge'
import { api, AttachmentEntry, connectWS } from '../api'
import { BacklinksPanel } from './BacklinksPanel'
import { CommentsRail } from './CommentsRail'
import { HistoryDialog } from './HistoryDialog'
import { OutlinePanel } from './OutlinePanel'
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
  const [backlinksOpen, setBacklinksOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  // Open by default on desktop; collapsed on small screens (where it overlays).
  const [outlineOpen, setOutlineOpen] = useState(
    () => typeof window === 'undefined' || window.matchMedia('(min-width: 769px)').matches,
  )
  const mdRef = useRef<MarkdownEditorHandle>(null)

  const dirty = content !== saved

  // Mirror latest values so teardown closures (navigation/unmount) see them.
  const contentRef = useRef(content)
  contentRef.current = content
  const savedRef = useRef(saved)
  savedRef.current = saved
  const modeRef = useRef(mode)
  modeRef.current = mode
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  // Freshest markdown: prefer the live editor (avoids the 280ms bridge lag),
  // falling back to React state when the editor is gone.
  const latestContent = useCallback(() => {
    if (modeRef.current === 'rich' || modeRef.current === 'split') {
      const live = window.mindbaseGetMarkdown?.()
      if (typeof live === 'string') return live
    }
    return contentRef.current
  }, [])

  const load = useCallback(async () => {
    try {
      const note = await api.notes.get(path)
      setContent(note.content)
      setSaved(note.content)
    } catch {
      // Following a [[wiki-link]] to a note that doesn't exist yet: start a
      // titled draft. `saved` matches it so an untouched draft isn't dirty
      // (no stray auto-created note); typing makes it dirty and creates it.
      const title = path.replace(/\.md$/, '').split('/').pop() ?? 'Untitled'
      const draft = `# ${title}\n\n`
      setContent(draft)
      setSaved(draft)
      setStatus('New note — start typing to create it.')
    }
    const files = await api.attachments.list(path).catch(() => [])
    setAttachments(files)
  }, [path])

  useEffect(() => {
    setStatus('')
    load().catch((e) => setStatus(String(e)))
  }, [load])

  useEffect(() => {
    const ws = connectWS((type, p) => {
      // Don't reload over in-progress local edits (also avoids a self-reload
      // echo from our own autosave write).
      if (type === 'note' && p.endsWith(path) && !dirtyRef.current) load()
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

  // ⌘S / Ctrl+S saves (ref keeps the latest save closure without re-subscribing).
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Autosave persists the live editor markdown and advances the `saved`
  // baseline only — it never calls setContent, so a slow round-trip can't push
  // a stale snapshot back into the editor and clobber newer keystrokes.
  const autosave = useCallback(async () => {
    const current = latestContent()
    if (current === savedRef.current) return
    try {
      await api.notes.save(path, current)
      savedRef.current = current
      setSaved(current)
      setStatus('Saved')
      setTimeout(() => setStatus(''), 1200)
    } catch (e) {
      setStatus(String(e))
    }
  }, [path, latestContent])

  // Debounced autosave: persist ~1.2s after the user stops editing.
  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(() => void autosave(), 1200)
    return () => clearTimeout(t)
  }, [content, dirty, autosave])

  // Flush unsaved edits when leaving the note (path change / unmount) or
  // closing the tab — so navigating away before autosave never loses changes.
  useEffect(() => {
    const flush = () => {
      const latest = latestContent()
      if (latest !== savedRef.current) api.notes.saveBeacon(path, latest)
    }
    window.addEventListener('beforeunload', flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      flush()
    }
  }, [path, latestContent])

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
              <Columns2 size={16} />
            </button>
            <button type="button" className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')} title="Preview">
              <Eye size={16} />
            </button>
          </div>
          <button
            type="button"
            className={`icon-btn ${outlineOpen ? 'is-active' : ''}`}
            title="Outline"
            aria-label="Outline"
            onClick={() => setOutlineOpen((v) => !v)}
          >
            <ListTree size={16} />
          </button>
          <button
            type="button"
            className={`icon-btn ${backlinksOpen ? 'is-active' : ''}`}
            title="Backlinks"
            aria-label="Backlinks"
            onClick={() => setBacklinksOpen((v) => !v)}
          >
            <Link2 size={16} />
          </button>
          <button
            type="button"
            className={`icon-btn ${commentsOpen ? 'is-active' : ''}`}
            title="Comments"
            aria-label="Comments"
            onClick={() => setCommentsOpen((v) => !v)}
          >
            <MessageSquare size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Version history"
            aria-label="Version history"
            onClick={() => setHistoryOpen(true)}
          >
            <History size={16} />
          </button>
          <button type="button" className="primary" onClick={save} disabled={!dirty}>
            <Save size={16} /> Save
          </button>
          <button type="button" onClick={remove} className="danger" title="Delete note" aria-label="Delete note">
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
        {outlineOpen && <OutlinePanel onClose={() => setOutlineOpen(false)} />}
        {backlinksOpen && <BacklinksPanel notePath={path} onClose={() => setBacklinksOpen(false)} />}
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

      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        notePath={path}
        onRestored={() => void load()}
      />
    </div>
  )
}
