import { FileText, Database, Paperclip, Plus, Menu, X } from 'lucide-react'
import { NoteEntry, DatabaseEntry } from '../api'

type View = 'notes' | 'databases'

interface Props {
  notes: NoteEntry[]
  databases: DatabaseEntry[]
  selectedNote?: string
  selectedDatabase?: string
  view: View
  open: boolean
  onToggle: () => void
  onViewChange: (view: View) => void
  onSelectNote: (path: string) => void
  onSelectDatabase: (name: string) => void
  onNewNote: () => void
  onNewDatabase: () => void
}

export function Sidebar({
  notes,
  databases,
  selectedNote,
  selectedDatabase,
  view,
  open,
  onToggle,
  onViewChange,
  onSelectNote,
  onSelectDatabase,
  onNewNote,
  onNewDatabase,
}: Props) {
  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onToggle} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1>mindbase</h1>
          <button type="button" className="icon-btn mobile-only" onClick={onToggle} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="view-tabs">
          <button
            type="button"
            className={view === 'notes' ? 'active' : ''}
            onClick={() => onViewChange('notes')}
          >
            <FileText size={16} /> Notes
          </button>
          <button
            type="button"
            className={view === 'databases' ? 'active' : ''}
            onClick={() => onViewChange('databases')}
          >
            <Database size={16} /> Databases
          </button>
        </div>

        {view === 'notes' ? (
          <>
            <button type="button" className="new-btn" onClick={onNewNote}>
              <Plus size={16} /> New note
            </button>
            <ul className="item-list">
              {notes.map((n) => (
                <li key={n.path}>
                  <button
                    type="button"
                    className={selectedNote === n.path ? 'active' : ''}
                    onClick={() => {
                      onSelectNote(n.path)
                      onToggle()
                    }}
                  >
                    <FileText size={14} />
                    <span>{n.title}</span>
                    {n.hasAttachments && <Paperclip size={12} />}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <button type="button" className="new-btn" onClick={onNewDatabase}>
              <Plus size={16} /> New database
            </button>
            <ul className="item-list">
              {databases.map((d) => (
                <li key={d.name}>
                  <button
                    type="button"
                    className={selectedDatabase === d.name ? 'active' : ''}
                    onClick={() => {
                      onSelectDatabase(d.name)
                      onToggle()
                    }}
                  >
                    <Database size={14} />
                    <span>{d.name}</span>
                    <small>{d.rows} rows</small>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
      <button type="button" className="menu-btn mobile-only" onClick={onToggle} aria-label="Menu">
        <Menu size={20} />
      </button>
    </>
  )
}
