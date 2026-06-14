import { Outlet, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { api, DatabaseEntry, NoteEntry } from '@/api'
import { Sidebar } from '@/components/Sidebar'

export function AppShell() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState<NoteEntry[]>([])
  const [databases, setDatabases] = useState<DatabaseEntry[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [vaultName, setVaultName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setError('')
    try {
      const [n, d, v] = await Promise.all([
        api.notes.list(),
        api.databases.list(),
        api.vault(),
      ])
      setNotes(n)
      setDatabases(d)
      setVaultName(v.name)
    } catch (e) {
      // Surface the failure instead of letting the empty lists read as
      // "No notes yet" — the sidebar shows an error rather than an empty state.
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const newNote = async () => {
    const name = prompt('Note name (e.g. ideas/project.md):')
    if (!name) return
    const path = name.endsWith('.md') ? name : `${name}.md`
    await api.notes.save(path, `# ${path.replace(/\.md$/, '')}\n\n`)
    await refresh()
    navigate(`/notes/${path}`)
  }

  const newDatabase = async () => {
    const name = prompt('Database name:')
    if (!name) return
    await api.databases.save(name, ['id', 'name'], [['1', 'Example']])
    await refresh()
    navigate(`/databases/${name}`)
  }

  return (
    <div className="flex h-full min-h-0 bg-background text-foreground">
      <Sidebar
        notes={notes}
        databases={databases}
        loading={loading}
        error={error}
        open={sidebarOpen}
        vaultName={vaultName}
        onToggle={() => setSidebarOpen((o) => !o)}
        onNewNote={newNote}
        onNewDatabase={newDatabase}
      />
      <main className="relative flex min-w-0 flex-1 flex-col">
        <Outlet context={{ refresh }} />
      </main>
    </div>
  )
}

export type ShellContext = { refresh: () => Promise<void> }
