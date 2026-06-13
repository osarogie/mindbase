import { useEffect, useState } from 'react'
import { api, type Commit } from '../api'
import { MarkdownPreview } from './MarkdownPreview'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  notePath: string
}

/** Browse a note's git-tracked version history (GET /api/history). */
export function HistoryDialog({ open, onOpenChange, notePath }: Props) {
  const [commits, setCommits] = useState<Commit[]>([])
  const [hasRepo, setHasRepo] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Commit | null>(null)
  const [snapshot, setSnapshot] = useState('')
  const [loadingSnap, setLoadingSnap] = useState(false)

  useEffect(() => {
    if (!open) return
    setError('')
    setSelected(null)
    setSnapshot('')
    api.history
      .log(notePath)
      .then((res) => {
        setHasRepo(res.has_repo)
        setCommits(res.commits ?? [])
      })
      .catch((e) => setError(String(e)))
  }, [open, notePath])

  const view = (c: Commit) => {
    setSelected(c)
    setLoadingSnap(true)
    setSnapshot('')
    api.history
      .snapshot(c.hash, notePath)
      .then((res) => setSnapshot(res.content))
      .catch((e) => setSnapshot(`_Failed to load snapshot: ${e}_`))
      .finally(() => setLoadingSnap(false))
  }

  const fmtDate = (iso: string) => {
    const t = new Date(iso).getTime()
    return Number.isFinite(t) ? new Date(iso).toLocaleString() : iso
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>{notePath.replace(/\.md$/, '')}</DialogDescription>
        </DialogHeader>

        {error && <div className="py-4 text-sm text-muted-foreground">{error}</div>}
        {!error && !hasRepo && (
          <div className="py-4 text-sm text-muted-foreground">
            This vault isn’t git-tracked yet — history appears after the first saved change.
          </div>
        )}
        {!error && hasRepo && commits.length === 0 && (
          <div className="py-4 text-sm text-muted-foreground">No history for this note yet.</div>
        )}

        {commits.length > 0 && (
          <div className="grid grid-cols-[minmax(12rem,16rem)_1fr] gap-3" style={{ maxHeight: '60vh' }}>
            <ul className="overflow-y-auto border-r border-border pr-2 text-sm">
              {commits.map((c) => (
                <li key={c.hash}>
                  <button
                    type="button"
                    className={`block w-full rounded-md px-2 py-1.5 text-left hover:bg-muted ${
                      selected?.hash === c.hash ? 'bg-muted' : ''
                    }`}
                    onClick={() => view(c)}
                  >
                    <div className="truncate font-medium">{c.subject || '(no message)'}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.short} · {fmtDate(c.date)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="overflow-y-auto">
              {!selected && (
                <div className="p-2 text-sm text-muted-foreground">Select a revision to preview it.</div>
              )}
              {selected && loadingSnap && <div className="p-2 text-sm text-muted-foreground">Loading…</div>}
              {selected && !loadingSnap && <MarkdownPreview content={snapshot} notePath={notePath} />}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
