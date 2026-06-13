import { MessageSquare, X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

/** Stubbed comments rail — UI shell only; the comments system has its own upcoming spec. */
export function CommentsRail({ open, onClose }: Props) {
  if (!open) return null
  return (
    <aside className="comments-rail" aria-label="Comments">
      <div className="comments-rail-header">
        <span>Comments</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close comments">
          <X size={16} />
        </button>
      </div>
      <div className="comments-rail-empty">
        <MessageSquare size={28} />
        <p>Comments are coming soon.</p>
        <p className="comments-rail-hint">You'll be able to attach threads to any text selection.</p>
      </div>
    </aside>
  )
}
