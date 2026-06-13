import { CornerDownLeft, Paperclip, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { countStats, readingTimeMinutes } from '@mindbase/editor-ui/textStats'
import { api, AttachmentEntry } from '../api'

interface Props {
  notePath: string
  mode: 'rich' | 'markdown' | 'preview' | 'split'
  content: string
  attachments: AttachmentEntry[]
  saveState: string
  onInsert: (name: string) => void
  onUpload: (file: File) => void
  onDelete: (name: string) => void
}

export function EditorFooter({ notePath, mode, content, attachments, saveState, onInsert, onUpload, onDelete }: Props) {
  const [bridgeStats, setBridgeStats] = useState({ words: 0, chars: 0 })
  const [expanded, setExpanded] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onBridge = (event: Event) => {
      const msg = (event as CustomEvent<{ type?: string; words?: number; chars?: number }>).detail
      if (msg?.type === 'stats' && typeof msg.words === 'number') {
        setBridgeStats({ words: msg.words, chars: msg.chars ?? 0 })
      }
    }
    window.addEventListener('mindbase-editor', onBridge)
    return () => window.removeEventListener('mindbase-editor', onBridge)
  }, [])

  // Rich/split render the Lexical editor (bridge stats); markdown/preview compute from content.
  const words = mode === 'rich' || mode === 'split' ? bridgeStats.words : countStats(content).words
  const minutes = readingTimeMinutes(words)

  return (
    <footer className="editor-footer">
      {expanded && (
        <div className="footer-attachments">
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onUpload(f)
              e.target.value = ''
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Upload
          </button>
          <ul>
            {attachments.length === 0 && <li className="footer-attachments-empty">No attachments</li>}
            {attachments.map((a) => (
              <li key={a.name}>
                <button
                  type="button"
                  className="icon-btn"
                  title="Insert into note"
                  aria-label={`Insert ${a.name} into note`}
                  onClick={() => onInsert(a.name)}
                >
                  <CornerDownLeft size={14} />
                </button>
                <a href={api.attachments.url(notePath, a.name)} target="_blank" rel="noreferrer">
                  {a.name}
                </a>
                <small>{(a.size / 1024).toFixed(1)} KB</small>
                <button
                  type="button"
                  className="icon-btn footer-attachments-delete"
                  title="Delete attachment"
                  aria-label={`Delete ${a.name}`}
                  onClick={() => onDelete(a.name)}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="editor-footer-bar">
        <span className="footer-stats">
          {words} words{minutes > 0 && ` · ${minutes} min`}
        </span>
        <button
          type="button"
          className={`footer-attachments-toggle ${expanded ? 'is-open' : ''}`}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <Paperclip size={14} /> {attachments.length} attachment{attachments.length === 1 ? '' : 's'}
        </button>
        <span className="footer-save-state">{saveState}</span>
      </div>
    </footer>
  )
}
