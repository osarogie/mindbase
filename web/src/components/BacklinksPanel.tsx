import { Link2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Backlink } from '../api'

interface Props {
  notePath: string
  onClose?: () => void
}

/** Reverse references: notes that link to the current note via [[wiki-links]]. */
export function BacklinksPanel({ notePath, onClose }: Props) {
  const navigate = useNavigate()
  const [links, setLinks] = useState<Backlink[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    api.notes
      .backlinks(notePath)
      .then((res) => {
        if (active) setLinks(res)
      })
      .catch(() => {
        if (active) setLinks([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [notePath])

  return (
    <aside className="outline-rail" aria-label="Backlinks">
      <div className="outline-rail-header">
        <span className="flex items-center gap-1.5">
          <Link2 size={15} /> Linked from
        </span>
        {onClose && (
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close backlinks">
            <X size={16} />
          </button>
        )}
      </div>
      {loading ? (
        <div className="outline-empty">Loading…</div>
      ) : links.length === 0 ? (
        <div className="outline-empty">No other notes link here yet.</div>
      ) : (
        <ul className="backlink-list">
          {links.map((b) => (
            <li key={b.path}>
              <button type="button" className="backlink-item" onClick={() => navigate(`/notes/${b.path}`)}>
                <span className="backlink-title">{b.title}</span>
                {b.context && <span className="backlink-context">{b.context}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
