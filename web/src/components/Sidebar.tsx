import { FileText, Database, Paperclip, Plus, Menu, X } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { NoteEntry, DatabaseEntry } from '../api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Props {
  notes: NoteEntry[]
  databases: DatabaseEntry[]
  open: boolean
  vaultName?: string
  onToggle: () => void
  onNewNote: () => void
  onNewDatabase: () => void
}

export function Sidebar({
  notes,
  databases,
  open,
  vaultName,
  onToggle,
  onNewNote,
  onNewDatabase,
}: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const notesActive = location.pathname.startsWith('/notes')
  const databasesActive = location.pathname.startsWith('/databases')

  const openNote = (path: string) => {
    navigate(`/notes/${path}`)
    onToggle()
  }

  const openDatabase = (name: string) => {
    navigate(`/databases/${name}`)
    onToggle()
  }

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onToggle} />}
      <aside className={cn('sidebar', open && 'open')}>
        <div className="sidebar-header">
          <h1>mindbase</h1>
          {vaultName && <Badge variant="secondary">{vaultName}</Badge>}
          <button type="button" className="icon-btn mobile-only" onClick={onToggle} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="view-tabs">
          <NavLink to="/" end className={({ isActive }) => cn(isActive && !notesActive && !databasesActive && 'active')}>
            Library
          </NavLink>
          <button
            type="button"
            className={notesActive ? 'active' : ''}
            onClick={() => notes[0] && openNote(notes[0].path)}
          >
            <FileText size={16} /> Notes
          </button>
          <button
            type="button"
            className={databasesActive ? 'active' : ''}
            onClick={() => databases[0] && openDatabase(databases[0].name)}
          >
            <Database size={16} /> Databases
          </button>
        </div>

        <Button type="button" className="mx-3 mb-2 w-[calc(100%-1.5rem)]" size="sm" onClick={onNewNote}>
          <Plus size={16} /> New note
        </Button>
        <ul className="item-list flex-1 overflow-y-auto">
          {notes.map((n) => (
            <li key={n.path}>
              <button
                type="button"
                className={location.pathname === `/notes/${n.path}` ? 'active' : ''}
                onClick={() => openNote(n.path)}
              >
                <FileText size={14} />
                <span>{n.title}</span>
                {n.hasAttachments && <Paperclip size={12} />}
              </button>
            </li>
          ))}
        </ul>

        <Button type="button" variant="outline" className="mx-3 mb-2 mt-2 w-[calc(100%-1.5rem)]" size="sm" onClick={onNewDatabase}>
          <Plus size={16} /> New database
        </Button>
        <ul className="item-list max-h-48 overflow-y-auto border-t border-border">
          {databases.map((d) => (
            <li key={d.name}>
              <button
                type="button"
                className={location.pathname === `/databases/${d.name}` ? 'active' : ''}
                onClick={() => openDatabase(d.name)}
              >
                <Database size={14} />
                <span>{d.name}</span>
                <small>{d.rows} rows</small>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <button type="button" className="menu-btn mobile-only" onClick={onToggle} aria-label="Menu">
        <Menu size={20} />
      </button>
    </>
  )
}
