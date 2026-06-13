import { ListTree, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface OutlineHeading {
  key: string
  text: string
  level: 1 | 2 | 3
}

interface Props {
  onClose?: () => void
}

/** Document outline shown as a rail to the right of the editor. Fed by 'outline' bridge events. */
export function OutlinePanel({ onClose }: Props) {
  const [headings, setHeadings] = useState<OutlineHeading[]>([])

  useEffect(() => {
    const onBridge = (event: Event) => {
      const msg = (event as CustomEvent<{ type?: string; headings?: OutlineHeading[] }>).detail
      if (msg?.type === 'outline' && Array.isArray(msg.headings)) setHeadings(msg.headings)
    }
    window.addEventListener('mindbase-editor', onBridge)
    return () => window.removeEventListener('mindbase-editor', onBridge)
  }, [])

  return (
    <aside className="outline-rail" aria-label="Document outline">
      <div className="outline-rail-header">
        <span className="flex items-center gap-1.5">
          <ListTree size={15} /> Outline
        </span>
        {onClose && (
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close outline">
            <X size={16} />
          </button>
        )}
      </div>
      {headings.length === 0 ? (
        <div className="outline-empty">No headings yet</div>
      ) : (
        <ul className="outline-list">
          {headings.map((h) => (
            <li key={h.key}>
              <button
                type="button"
                className={`outline-item level-${h.level}`}
                onClick={() => window.mindbaseScrollToHeading?.(h.key)}
              >
                {h.text || 'Untitled'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
