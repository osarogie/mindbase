import { useCallback, useEffect, useState } from 'react'
import {
  Columns3,
  Plus,
  Rows3,
  Save,
  Trash2,
} from 'lucide-react'
import { DatabaseTable } from '../api'
import { normalizeGrid } from '@/lib/tableMarkdown'
import { DatabaseGrid, type GridSelection } from './DatabaseGrid'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Props {
  table: DatabaseTable
  onSave: (headers: string[], rows: string[][]) => void
  onLiveChange?: (headers: string[], rows: string[][]) => void
  saving?: boolean
}

export function DatabaseEditor({ table, onSave, onLiveChange, saving }: Props) {
  const [headers, setHeaders] = useState(() => [...table.headers])
  const [rows, setRows] = useState(() => table.rows.map((r) => [...r]))
  const [dirty, setDirty] = useState(false)
  const [selection, setSelection] = useState<GridSelection | null>(null)

  const update = useCallback((h: string[], r: string[][]) => {
    const norm = normalizeGrid(h, r)
    setHeaders(norm.headers)
    setRows(norm.rows)
    setDirty(true)
    onLiveChange?.(norm.headers, norm.rows)
  }, [onLiveChange])

  const { headers: cols, rows: body } = normalizeGrid(headers, rows)

  const addRow = () => {
    update(cols, [...body, Array(cols.length).fill('')])
  }

  const addColumn = () => {
    const name = `col_${cols.length + 1}`
    update([...cols, name], body.map((r) => [...r, '']))
  }

  const deleteRow = () => {
    if (body.length === 0) return
    const idx =
      selection?.kind === 'body' ? selection.row : body.length - 1
    update(
      cols,
      body.filter((_, i) => i !== idx),
    )
    setSelection(null)
  }

  const deleteColumn = () => {
    if (cols.length <= 1) return
    const idx = selection?.col ?? cols.length - 1
    update(
      cols.filter((_, i) => i !== idx),
      body.map((r) => r.filter((_, i) => i !== idx)),
    )
    setSelection(null)
  }

  const save = useCallback(() => {
    const norm = normalizeGrid(headers, rows)
    onSave(norm.headers, norm.rows)
    setDirty(false)
  }, [headers, rows, onSave])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (dirty && !saving) save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dirty, saving, save])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-3.5" />
          Add row
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={addColumn}>
          <Columns3 className="size-3.5" />
          Add column
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={deleteRow}
          disabled={body.length === 0}
        >
          <Rows3 className="size-3.5" />
          Delete row
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={deleteColumn}
          disabled={cols.length <= 1}
        >
          <Trash2 className="size-3.5" />
          Delete column
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {dirty && (
            <Badge variant="secondary" className="font-normal">
              Unsaved changes
            </Badge>
          )}
          <Button type="button" size="sm" onClick={save} disabled={!dirty || saving}>
            <Save className="size-3.5" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      <DatabaseGrid
        headers={headers}
        rows={rows}
        selection={selection}
        onSelectionChange={setSelection}
        onChange={update}
        className="min-h-0 flex-1"
      />
    </div>
  )
}
