import { useCallback, useEffect, useState } from 'react'
import { api, NoteEntry, DatabaseEntry } from './api'
import { Sidebar } from './components/Sidebar'
import { NoteView } from './components/NoteView'
import { DatabaseView } from './components/DatabaseView'
import './styles.css'

type View = 'notes' | 'databases'

export default function App() {
  const [notes, setNotes] = useState<NoteEntry[]>([])
  const [databases, setDatabases] = useState<DatabaseEntry[]>([])
  const [view, setView] = useState<View>('notes')
  const [selectedNote, setSelectedNote] = useState<string>()
  const [selectedDatabase, setSelectedDatabase] = useState<string>()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [vaultName, setVaultName] = useState('')

  const refresh = useCallback(async () => {
    const [n, d, v] = await Promise.all([
      api.notes.list(),
      api.databases.list(),
      api.vault(),
    ])
    setNotes(n)
    setDatabases(d)
    setVaultName(v.name)
  }, [])

  useEffect(() => {
    refresh().catch(console.error)
  }, [refresh])

  const newNote = async () => {
    const name = prompt('Note name (e.g. ideas/project.md):')
    if (!name) return
    const path = name.endsWith('.md') ? name : `${name}.md`
    await api.notes.save(path, `# ${path.replace(/\.md$/, '')}\n\n`)
    await refresh()
    setView('notes')
    setSelectedNote(path)
  }

  const newDatabase = async () => {
    const name = prompt('Database name:')
    if (!name) return
    await api.databases.save(name, ['id', 'name'], [['1', 'Example']])
    await refresh()
    setView('databases')
    setSelectedDatabase(name)
  }

  return (
    <div className="app">
      <Sidebar
        notes={notes}
        databases={databases}
        selectedNote={selectedNote}
        selectedDatabase={selectedDatabase}
        view={view}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
        onViewChange={setView}
        onSelectNote={(p) => {
          setSelectedNote(p)
          setView('notes')
        }}
        onSelectDatabase={(n) => {
          setSelectedDatabase(n)
          setView('databases')
        }}
        onNewNote={newNote}
        onNewDatabase={newDatabase}
      />

      <main className="main">
        <div className="vault-badge">{vaultName}</div>
        {view === 'notes' && selectedNote ? (
          <NoteView
            path={selectedNote}
            onDeleted={() => {
              setSelectedNote(undefined)
              refresh()
            }}
          />
        ) : view === 'databases' && selectedDatabase ? (
          <DatabaseView
            name={selectedDatabase}
            onDeleted={() => {
              setSelectedDatabase(undefined)
              refresh()
            }}
          />
        ) : (
          <div className="empty-state">
            <h2>Welcome to mindbase</h2>
            <p>Your local-first notes vault. Select or create a note or database.</p>
            <ul>
              <li>Notes stored as Markdown</li>
              <li>Databases stored as CSV</li>
              <li>Attachments live beside each note</li>
              <li>Mermaid and Excalidraw blocks supported</li>
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}
