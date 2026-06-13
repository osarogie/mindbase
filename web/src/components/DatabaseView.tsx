import { useCallback, useEffect, useMemo, useState } from 'react'
import { Columns2, Eye, Table2, Trash2 } from 'lucide-react'
import { api, DatabaseTable, connectWS } from '../api'
import { DatabaseEditor } from './DatabaseEditor'
import { MarkdownPreview } from './MarkdownPreview'
import { tableToMarkdown } from '@/lib/tableMarkdown'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type ViewMode = 'grid' | 'split' | 'preview'

interface Props {
  name: string
  onDeleted: () => void
}

export function DatabaseView({ name, onDeleted }: Props) {
  const [table, setTable] = useState<DatabaseTable | null>(null)
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<ViewMode>('grid')
  const [liveHeaders, setLiveHeaders] = useState<string[]>([])
  const [liveRows, setLiveRows] = useState<string[][]>([])

  const load = useCallback(async () => {
    const data = await api.databases.get(name)
    setTable(data)
    setLiveHeaders(data.headers)
    setLiveRows(data.rows)
  }, [name])

  useEffect(() => {
    load().catch((e) => setStatus(String(e)))
  }, [load])

  useEffect(() => {
    const ws = connectWS((type) => {
      if (type === 'database') load()
    })
    return () => ws.close()
  }, [load])

  const save = async (headers: string[], rows: string[][]) => {
    setSaving(true)
    setStatus('Saving…')
    try {
      const data = await api.databases.save(name, headers, rows)
      setTable(data)
      setLiveHeaders(data.headers)
      setLiveRows(data.rows)
      setStatus('Saved')
      setTimeout(() => setStatus(''), 1500)
    } catch (e) {
      setStatus(String(e))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!confirm(`Delete database ${name}?`)) return
    await api.databases.delete(name)
    onDeleted()
  }

  const previewMarkdown = useMemo(
    () => tableToMarkdown(name, liveHeaders, liveRows),
    [name, liveHeaders, liveRows],
  )

  if (!table) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Table2 className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">{name}.csv</h2>
        <Badge variant="outline" className="font-normal">
          {liveRows.length} rows · {Math.max(liveHeaders.length, 1)} cols
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            {(
              [
                ['grid', 'Table', Table2],
                ['split', 'Split', Columns2],
                ['preview', 'Preview', Eye],
              ] as const
            ).map(([id, label, Icon]) => (
              <Button
                key={id}
                type="button"
                variant="ghost"
                size="sm"
                className={cn('h-7', mode === id && 'bg-muted')}
                onClick={() => setMode(id)}
              >
                <Icon className="size-3.5" />
                {label}
              </Button>
            ))}
          </div>
          {status && (
            <span className="text-sm text-muted-foreground">{status}</span>
          )}
          <Button type="button" variant="destructive" size="icon-sm" onClick={remove}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </header>

      <div
        className={cn(
          'grid min-h-0 flex-1 overflow-hidden',
          mode === 'split' ? 'grid-cols-2' : 'grid-cols-1',
        )}
      >
        {mode !== 'preview' && (
          <DatabaseEditor
            key={name}
            table={table}
            saving={saving}
            onSave={save}
            onLiveChange={(headers, rows) => {
              setLiveHeaders(headers)
              setLiveRows(rows)
            }}
          />
        )}
        {mode !== 'grid' && (
          <div className="min-h-0 overflow-auto border-l border-border bg-card p-4">
            <MarkdownPreview content={previewMarkdown} />
          </div>
        )}
      </div>
    </div>
  )
}
