import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'

interface OutlineHeading {
  key: string
  text: string
  level: 1 | 2 | 3
}

interface Props {
  title: string
  onBack: () => void
}

/** Document outline shown in the sidebar while a note is open. Fed by 'outline' bridge events. */
export function OutlinePanel({ title, onBack }: Props) {
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
    <div className="outline-panel">
      <button type="button" className="outline-back" onClick={onBack}>
        <ArrowLeft size={16} /> Library
      </button>
      <div className="outline-title">{title}</div>
      <div className="outline-label">Outline</div>
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
    </div>
  )
}
