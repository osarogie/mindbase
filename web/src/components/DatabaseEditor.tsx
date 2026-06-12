import { useState } from 'react'
import { DatabaseTable } from '../api'

interface Props {
  table: DatabaseTable
  onSave: (headers: string[], rows: string[][]) => void
}

export function DatabaseEditor({ table, onSave }: Props) {
  const [headers, setHeaders] = useState(() => [...table.headers])
  const [rows, setRows] = useState(() => table.rows.map((r) => [...r]))

  const colCount = Math.max(headers.length, ...rows.map((r) => r.length), 1)

  const normalize = () => {
    const h = Array.from({ length: colCount }, (_, i) => headers[i] ?? `col_${i + 1}`)
    const r = rows.map((row) =>
      Array.from({ length: colCount }, (_, i) => row[i] ?? ''),
    )
    return { h, r }
  }

  const updateHeader = (idx: number, value: string) => {
    const next = [...headers]
    while (next.length <= idx) next.push('')
    next[idx] = value
    setHeaders(next)
  }

  const updateCell = (rowIdx: number, colIdx: number, value: string) => {
    const next = rows.map((r) => [...r])
    while (next.length <= rowIdx) next.push([])
    while (next[rowIdx].length <= colIdx) next[rowIdx].push('')
    next[rowIdx][colIdx] = value
    setRows(next)
  }

  const addRow = () => setRows([...rows, Array(colCount).fill('')])
  const addColumn = () => {
    setHeaders([...headers, `col_${headers.length + 1}`])
    setRows(rows.map((r) => [...r, '']))
  }

  const handleSave = () => {
    const { h, r } = normalize()
    onSave(h, r)
  }

  return (
    <div className="database-editor">
      <div className="database-toolbar">
        <button type="button" onClick={addRow}>Add row</button>
        <button type="button" onClick={addColumn}>Add column</button>
        <button type="button" className="primary" onClick={handleSave}>Save</button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {Array.from({ length: colCount }).map((_, i) => (
                <th key={i}>
                  <input
                    value={headers[i] ?? ''}
                    onChange={(e) => updateHeader(i, e.target.value)}
                    placeholder={`Column ${i + 1}`}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {Array.from({ length: colCount }).map((_, ci) => (
                  <td key={ci}>
                    <input
                      value={row[ci] ?? ''}
                      onChange={(e) => updateCell(ri, ci, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
