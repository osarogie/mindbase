import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { cn } from '@/lib/utils'
import { normalizeGrid, parseClipboardGrid } from '@/lib/tableMarkdown'

export type GridSelection = {
  row: number
  col: number
  kind: 'header' | 'body'
}

interface Props {
  headers: string[]
  rows: string[][]
  onChange: (headers: string[], rows: string[][]) => void
  selection: GridSelection | null
  onSelectionChange: (sel: GridSelection | null) => void
  className?: string
}

export function DatabaseGrid({
  headers,
  rows,
  onChange,
  selection,
  onSelectionChange,
  className,
}: Props) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const { headers: cols, rows: body } = useMemo(
    () => normalizeGrid(headers, rows),
    [headers, rows],
  )

  const commit = useCallback(
    (nextHeaders: string[], nextRows: string[][]) => {
      onChange(...Object.values(normalizeGrid(nextHeaders, nextRows)))
    },
    [onChange],
  )

  const getCellValue = useCallback(
    (sel: GridSelection) => {
      if (sel.kind === 'header') return cols[sel.col] ?? ''
      return body[sel.row]?.[sel.col] ?? ''
    },
    [cols, body],
  )

  const setCellValue = useCallback(
    (sel: GridSelection, value: string) => {
      if (sel.kind === 'header') {
        const next = [...cols]
        next[sel.col] = value
        commit(next, body)
        return
      }
      const next = body.map((r) => [...r])
      while (next.length <= sel.row) next.push(Array(cols.length).fill(''))
      next[sel.row][sel.col] = value
      commit(cols, next)
    },
    [cols, body, commit],
  )

  const startEdit = useCallback(
    (sel: GridSelection, initial = '') => {
      onSelectionChange(sel)
      setEditing(true)
      setDraft(initial || getCellValue(sel))
    },
    [getCellValue, onSelectionChange],
  )

  const finishEdit = useCallback(
    (save: boolean) => {
      if (editing && selection && save) setCellValue(selection, draft)
      setEditing(false)
    },
    [editing, selection, draft, setCellValue],
  )

  const moveSelection = useCallback(
    (deltaRow: number, deltaCol: number) => {
      if (!selection) {
        onSelectionChange({ row: 0, col: 0, kind: 'header' })
        return
      }
      let { row, col, kind } = selection
      col = Math.max(0, Math.min(cols.length - 1, col + deltaCol))
      if (kind === 'header') {
        if (deltaRow > 0) {
          onSelectionChange({ row: 0, col, kind: 'body' })
          return
        }
        onSelectionChange({ row: 0, col, kind: 'header' })
        return
      }
      row = Math.max(0, Math.min(Math.max(body.length - 1, 0), row + deltaRow))
      if (deltaRow < 0 && row === 0 && selection.row === 0) {
        onSelectionChange({ row: 0, col, kind: 'header' })
        return
      }
      onSelectionChange({ row, col, kind: 'body' })
    },
    [selection, cols.length, body.length, onSelectionChange],
  )

  const applyPaste = useCallback(
    (text: string, at: GridSelection) => {
      const pasted = parseClipboardGrid(text)
      if (pasted.length === 0) return
      let nextHeaders = [...cols]
      let nextRows = body.map((r) => [...r])
      const startRow = at.kind === 'header' ? 0 : at.row
      const startCol = at.col

      pasted.forEach((pasteRow, ri) => {
        const targetRow = startRow + ri
        if (at.kind === 'header' && ri === 0) {
          pasteRow.forEach((val, ci) => {
            const c = startCol + ci
            while (nextHeaders.length <= c) nextHeaders.push(`col_${nextHeaders.length + 1}`)
            nextHeaders[c] = val
          })
          return
        }
        while (nextRows.length <= targetRow) nextRows.push(Array(nextHeaders.length).fill(''))
        pasteRow.forEach((val, ci) => {
          const c = startCol + ci
          while (nextHeaders.length <= c) nextHeaders.push(`col_${nextHeaders.length + 1}`)
          while (nextRows[targetRow].length <= c) nextRows[targetRow].push('')
          nextRows[targetRow][c] = val
        })
      })
      commit(nextHeaders, nextRows)
    },
    [cols, body, commit],
  )

  const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editing) return
    if (!selection && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      moveSelection(0, e.shiftKey ? -1 : 1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) moveSelection(-1, 0)
      else if (selection) startEdit(selection)
      else startEdit({ row: 0, col: 0, kind: 'header' })
      return
    }
    if (e.key === 'F2' && selection) {
      e.preventDefault()
      startEdit(selection)
      return
    }
    if (e.key === 'Escape') return
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveSelection(-1, 0)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveSelection(1, 0)
      return
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      moveSelection(0, -1)
      return
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      moveSelection(0, 1)
      return
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
      e.preventDefault()
      setCellValue(selection, '')
      return
    }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && selection) {
      e.preventDefault()
      startEdit(selection, e.key)
    }
  }

  const onPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain')
    if (!text || !selection) return
    e.preventDefault()
    applyPaste(text, selection)
  }

  useEffect(() => {
    gridRef.current?.focus()
  }, [])

  const selectedKey = selection
    ? `${selection.kind}:${selection.row}:${selection.col}`
    : ''

  return (
    <div
      ref={gridRef}
      tabIndex={0}
      role="grid"
      aria-label="Database table"
      className={cn(
        'outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-md',
        className,
      )}
      onKeyDown={onGridKeyDown}
      onPaste={onPaste}
    >
      <div className="overflow-auto rounded-md border border-border bg-card shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-10 border-b border-r border-border bg-muted/80 px-1 py-1 text-center text-xs font-normal text-muted-foreground">
                #
              </th>
              {cols.map((header, ci) => {
                const sel = selection?.kind === 'header' && selection.col === ci
                return (
                  <th
                    key={ci}
                    className={cn(
                      'min-w-[8rem] border-b border-r border-border bg-muted/50 p-0 last:border-r-0',
                      sel && 'ring-2 ring-inset ring-primary/60',
                    )}
                  >
                    {sel && editing ? (
                      <input
                        autoFocus
                        className="w-full bg-background px-2 py-1.5 font-semibold outline-none"
                        value={draft}
                        onChange={(ev) => setDraft(ev.target.value)}
                        onBlur={() => finishEdit(true)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') {
                            ev.preventDefault()
                            finishEdit(true)
                            onSelectionChange({ row: 0, col: ci, kind: 'body' })
                          } else if (ev.key === 'Escape') {
                            ev.preventDefault()
                            finishEdit(false)
                          } else if (ev.key === 'Tab') {
                            ev.preventDefault()
                            finishEdit(true)
                            moveSelection(0, ev.shiftKey ? -1 : 1)
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="block w-full px-2 py-1.5 text-left font-semibold hover:bg-accent/50"
                        onClick={() => {
                          onSelectionChange({ row: 0, col: ci, kind: 'header' })
                          setEditing(false)
                        }}
                        onDoubleClick={() => startEdit({ row: 0, col: ci, kind: 'header' })}
                      >
                        {header || <span className="text-muted-foreground">Column {ci + 1}</span>}
                      </button>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {body.length === 0 ? (
              <tr>
                <td
                  colSpan={cols.length + 1}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No rows yet — use <strong>Add row</strong> or paste from a spreadsheet.
                </td>
              </tr>
            ) : (
              body.map((row, ri) => (
                <tr key={ri} className="group">
                  <td className="sticky left-0 z-10 border-b border-r border-border bg-muted/60 px-1 py-0 text-center text-xs text-muted-foreground">
                    {ri + 1}
                  </td>
                  {cols.map((_, ci) => {
                    const sel =
                      selection?.kind === 'body' && selection.row === ri && selection.col === ci
                    const value = row[ci] ?? ''
                    return (
                      <td
                        key={`${ri}-${ci}`}
                        data-selected={sel ? 'true' : undefined}
                        className={cn(
                          'min-w-[8rem] border-b border-r border-border p-0 last:border-r-0',
                          sel && 'ring-2 ring-inset ring-primary/60 bg-primary/5',
                          !sel && 'hover:bg-muted/30',
                        )}
                      >
                        {sel && editing ? (
                          <input
                            autoFocus
                            className="w-full bg-background px-2 py-1.5 outline-none"
                            value={draft}
                            onChange={(ev) => setDraft(ev.target.value)}
                            onBlur={() => finishEdit(true)}
                            onKeyDown={(ev) => {
                              if (ev.key === 'Enter') {
                                ev.preventDefault()
                                finishEdit(true)
                                onSelectionChange({
                                  row: Math.min(ri + 1, body.length - 1),
                                  col: ci,
                                  kind: 'body',
                                })
                              } else if (ev.key === 'Escape') {
                                ev.preventDefault()
                                finishEdit(false)
                              } else if (ev.key === 'Tab') {
                                ev.preventDefault()
                                finishEdit(true)
                                moveSelection(0, ev.shiftKey ? -1 : 1)
                              }
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="block w-full px-2 py-1.5 text-left"
                            onClick={() => {
                              onSelectionChange({ row: ri, col: ci, kind: 'body' })
                              setEditing(false)
                            }}
                            onDoubleClick={() =>
                              startEdit({ row: ri, col: ci, kind: 'body' })
                            }
                          >
                            {value || '\u00a0'}
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Click to select · double-click or type to edit · Tab/Enter to move · paste from Excel/Sheets
        {selectedKey ? ` · selected ${selection?.kind === 'header' ? 'header' : `row ${(selection?.row ?? 0) + 1}`}` : ''}
      </p>
    </div>
  )
}
