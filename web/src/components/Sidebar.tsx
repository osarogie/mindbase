import { useMemo } from 'react'
import { FileText, Database, Paperclip, Plus, Menu, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { NoteEntry, DatabaseEntry } from '../api'
import { SearchBox } from './SearchBox'
import { ThemeToggle } from './ThemeToggle'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Props {
  notes: NoteEntry[]
  databases: DatabaseEntry[]
  loading: boolean
  error?: string
  open: boolean
  vaultName?: string
  onToggle: () => void
  onNewNote: () => void
  onNewDatabase: () => void
}

type FileItem =
  | { kind: 'note'; key: string; route: string; title: string; modified: string; note: NoteEntry }
  | { kind: 'database'; key: string; route: string; title: string; modified: string; db: DatabaseEntry }

export function Sidebar({
  notes,
  databases,
  loading,
  error,
  open,
  vaultName,
  onToggle,
  onNewNote,
  onNewDatabase,
}: Props) {
  const navigate = useNavigate()
  const location = useLocation()

  // Notes and databases share one recency-sorted list (newest first) so the
  // whole vault reads as a single stream of files rather than two sections.
  const items = useMemo<FileItem[]>(() => {
    const merged: FileItem[] = [
      ...notes.map((n): FileItem => ({
        kind: 'note',
        key: `note:${n.path}`,
        route: `/notes/${n.path}`,
        title: n.title,
        modified: n.modified,
        note: n,
      })),
      ...databases.map((d): FileItem => ({
        kind: 'database',
        key: `db:${d.name}`,
        route: `/databases/${d.name}`,
        title: d.name,
        modified: d.modified,
        db: d,
      })),
    ]
    // Compare as epoch millis rather than raw RFC3339 strings: Go's time.Time
    // JSON can vary in fractional-second length and timezone offset (Z vs
    // +hh:mm), which a lexical compare would mis-order for equal instants.
    const ts = (s: string) => {
      const t = Date.parse(s)
      return Number.isNaN(t) ? 0 : t
    }
    return merged.sort((a, b) => ts(b.modified) - ts(a.modified))
  }, [notes, databases])

  const openItem = (route: string) => {
    navigate(route)
    onToggle()
  }

  const empty = !error && !loading && items.length === 0

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onToggle} />}
      <aside className={cn('sidebar', open && 'open')}>
        <div className="sidebar-header">
          <h1>mindbase</h1>
          {vaultName && <Badge variant="secondary">{vaultName}</Badge>}
          <span className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <button type="button" className="icon-btn mobile-only" onClick={onToggle} aria-label="Close">
              <X size={20} />
            </button>
          </span>
        </div>

        <SearchBox onNavigate={onToggle} />

        <div className="new-row">
          <Button type="button" size="sm" className="flex-1" onClick={onNewNote}>
            <Plus size={16} /> Note
          </Button>
          <Button type="button" size="sm" variant="outline" className="flex-1" onClick={onNewDatabase}>
            <Plus size={16} /> Database
          </Button>
        </div>

        <ul className="item-list flex-1 overflow-y-auto">
          {error && (
            <li className="item-list-empty item-list-error">
              Couldn’t load the vault. Check the server and retry.
            </li>
          )}
          {!error && loading && <li className="item-list-empty">Loading…</li>}
          {empty && (
            <li className="item-list-empty">No files yet. Create a note or database above.</li>
          )}
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                className={location.pathname === item.route ? 'active' : ''}
                onClick={() => openItem(item.route)}
              >
                {item.kind === 'note' ? <FileText size={14} /> : <Database size={14} />}
                <span>{item.title}</span>
                {item.kind === 'note' && item.note.hasAttachments && <Paperclip size={12} />}
                {item.kind === 'database' && <small>{item.db.rows} rows</small>}
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
