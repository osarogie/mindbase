export interface NoteEntry {
  path: string
  title: string
  modified: string
  size: number
  hasAttachments: boolean
}

export interface Note {
  path: string
  title: string
  content: string
}

export interface DatabaseEntry {
  name: string
  path: string
  modified: string
  rows: number
  columns: number
}

export interface DatabaseTable {
  name: string
  path: string
  headers: string[]
  rows: string[][]
}

export interface AttachmentEntry {
  name: string
  path: string
  size: number
  mimeType: string
  modified: string
}

export interface SearchResult {
  path: string
  title: string
  type: 'note' | 'database'
  snippet: string
  score: number
  modified: string
}

export interface Commit {
  hash: string
  short: string
  author: string
  email: string
  date: string
  subject: string
  files?: string[]
}

export interface HistoryLog {
  path: string
  has_repo: boolean
  commits: Commit[] | null
}

export interface ConnectorStatus {
  notion: {
    connected: boolean
    last_import?: string
    import_dir: string
    cached_pages: number
  }
  gdrive: {
    connected: boolean
    last_sync?: string
    folder_id: string
    cached_files: number
  }
  config: {
    source: string
    sink: string
    auto_sync: boolean
    sync_interval_min: number
  }
}

export interface SyncResult {
  notion?: { imported: number; updated: number; skipped: number; cached: number; error?: string }
  gdrive?: { uploaded: number; updated: number; downloaded: number; error?: string }
  cache?: Record<string, unknown>
}

export interface CredentialsView {
  notion_token_set: boolean
  notion_token_preview?: string
  notion_oauth_configured: boolean
  notion_oauth_connected: boolean
  gdrive_connected: boolean
  gdrive_auth_method?: string
  google_oauth_configured: boolean
}

export interface Backlink {
  path: string
  title: string
  context: string
}

export interface UpdateCredentials {
  notion_token?: string
  gdrive_credentials_json?: string
  clear?: string[]
}

// Full connector config round-trips opaquely; we only edit a few known fields.
export type ConnectorConfig = Record<string, unknown> & {
  auto_sync?: boolean
  sync_interval_min?: number
  source?: string
  sink?: string
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  vault: () => request<{ root: string; name: string }>('/api/vault'),
  search: (q: string) =>
    request<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`).then((r) => r ?? []),
  history: {
    log: (path: string) =>
      request<HistoryLog>(`/api/history?path=${encodeURIComponent(path)}`),
    snapshot: (rev: string, path: string) =>
      request<{ rev: string; path: string; content: string }>(
        `/api/history/${rev}?path=${encodeURIComponent(path)}`,
      ),
  },
  notes: {
    list: () => request<NoteEntry[]>('/api/notes/'),
    get: (path: string) => request<Note>(`/api/notes/${path}`),
    save: (path: string, content: string) =>
      request<Note>(`/api/notes/${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }),
    delete: (path: string) =>
      request<void>(`/api/notes/${path}`, { method: 'DELETE' }),
    backlinks: (path: string) =>
      request<Backlink[]>(`/api/backlinks/${path}`).then((r) => r ?? []),
    /**
     * Fire-and-forget save that survives the page unloading or the editor
     * unmounting (keepalive). Used to flush unsaved edits when navigating away.
     */
    saveBeacon: (path: string, content: string) => {
      try {
        void fetch(`/api/notes/${path}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
          keepalive: true,
        })
      } catch {
        /* best effort */
      }
    },
  },
  databases: {
    list: () => request<DatabaseEntry[]>('/api/databases/'),
    get: (name: string) => request<DatabaseTable>(`/api/databases/${name}`),
    save: (name: string, headers: string[], rows: string[][]) =>
      request<DatabaseTable>(`/api/databases/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers, rows }),
      }),
    delete: (name: string) =>
      request<void>(`/api/databases/${name}`, { method: 'DELETE' }),
  },
  attachments: {
    list: (notePath: string) =>
      request<AttachmentEntry[]>(`/api/attachments/${notePath}`),
    upload: async (notePath: string, file: File) => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/attachments/${notePath}`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) throw new Error('Upload failed')
      return res.json() as Promise<AttachmentEntry>
    },
    delete: (notePath: string, filename: string) =>
      request<void>(`/api/attachments/${notePath}/${filename}`, {
        method: 'DELETE',
      }),
    url: (notePath: string, filename: string) =>
      `/api/files/${notePath}/${filename}`,
  },
  connectors: {
    status: () => request<ConnectorStatus>('/api/connectors/status'),
    sync: () => request<SyncResult>('/api/connectors/sync', { method: 'POST' }),
    resetNotion: () =>
      request<{ cleared: number }>('/api/connectors/notion/reset', { method: 'POST' }),
    credentials: {
      get: () => request<CredentialsView>('/api/connectors/credentials'),
      update: (req: UpdateCredentials) =>
        request<CredentialsView>('/api/connectors/credentials', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req),
        }),
    },
    config: {
      get: () => request<ConnectorConfig>('/api/connectors/config'),
      update: (cfg: ConnectorConfig) =>
        request<ConnectorConfig>('/api/connectors/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cfg),
        }),
    },
    oauth: {
      gdriveStart: () =>
        request<{ auth_url: string }>('/api/connectors/gdrive/oauth/start'),
      notionStart: () =>
        request<{ auth_url: string }>('/api/connectors/notion/oauth/start'),
    },
  },
}

export function connectWS(onEvent: (type: string, path: string) => void) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${proto}://${location.host}/api/ws`)
  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data)
      onEvent(data.type, data.path)
    } catch {
      /* ignore */
    }
  }
  return ws
}
