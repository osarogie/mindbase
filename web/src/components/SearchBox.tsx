import { Database, FileText, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type SearchResult } from '../api'

interface Props {
  /** Called after navigating to a result (e.g. to close the mobile sidebar). */
  onNavigate?: () => void
}

/** Full-text search over notes + databases, backed by GET /api/search. */
export function SearchBox({ onNavigate }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const id = setTimeout(() => {
      api.search(q)
        .then((r) => {
          setResults(r)
          setOpen(true)
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(id)
  }, [query])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const go = (r: SearchResult) => {
    if (r.type === 'database') {
      navigate(`/databases/${r.path.replace(/\.csv$/, '')}`)
    } else {
      navigate(`/notes/${r.path}`)
    }
    setQuery('')
    setResults([])
    setOpen(false)
    onNavigate?.()
  }

  return (
    <div className="search-box" ref={boxRef}>
      <div className="search-input-row">
        <Search size={14} />
        <input
          type="search"
          placeholder="Search notes & databases"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          aria-label="Search notes and databases"
        />
        {query && (
          <button type="button" className="icon-btn" onClick={() => setQuery('')} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>
      {open && query.trim() && (
        <ul className="search-results">
          {loading && <li className="search-empty">Searching…</li>}
          {!loading && results.length === 0 && <li className="search-empty">No matches</li>}
          {results.map((r) => (
            <li key={`${r.type}:${r.path}`}>
              <button type="button" className="search-result" onClick={() => go(r)}>
                <span className="search-result-title">
                  {r.type === 'database' ? <Database size={13} /> : <FileText size={13} />}
                  {r.title || r.path}
                </span>
                {r.snippet && <span className="search-result-snippet">{r.snippet}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
