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
