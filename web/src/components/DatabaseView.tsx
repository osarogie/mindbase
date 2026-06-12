import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { api, DatabaseTable, connectWS } from '../api'
import { DatabaseEditor } from './DatabaseEditor'

interface Props {
  name: string
  onDeleted: () => void
}

export function DatabaseView({ name, onDeleted }: Props) {
  const [table, setTable] = useState<DatabaseTable | null>(null)
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    const data = await api.databases.get(name)
    setTable(data)
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
    setStatus('Saving…')
    try {
      const data = await api.databases.save(name, headers, rows)
      setTable(data)
      setStatus('Saved')
      setTimeout(() => setStatus(''), 1500)
    } catch (e) {
      setStatus(String(e))
    }
  }

  const remove = async () => {
    if (!confirm(`Delete database ${name}?`)) return
    await api.databases.delete(name)
    onDeleted()
  }

  if (!table) return <div className="empty-state">Loading…</div>

  return (
    <div className="database-view">
      <header className="content-header">
        <h2>{name}.csv</h2>
        <div className="header-actions">
          {status && <span className="status">{status}</span>}
          <button type="button" onClick={remove} className="danger">
            <Trash2 size={16} />
          </button>
        </div>
      </header>
      <DatabaseEditor table={table} onSave={save} />
    </div>
  )
}
