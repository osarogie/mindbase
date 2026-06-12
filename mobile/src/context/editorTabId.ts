export type EditorDocumentKind = 'note' | 'database' | 'image' | 'pdf' | 'epub' | 'csv';

export function editorTabId(kind: EditorDocumentKind, path: string): string {
  return `${kind}:${path}`;
}

export function noteTabId(path: string): string {
  return editorTabId('note', path);
}

export function databaseTabId(path: string): string {
  return editorTabId('database', path);
}

export function parseEditorTabId(id: string): { kind: EditorDocumentKind; path: string } | null {
  const idx = id.indexOf(':');
  if (idx <= 0) return null;
  const kind = id.slice(0, idx);
  if (
    kind !== 'note' &&
    kind !== 'database' &&
    kind !== 'image' &&
    kind !== 'pdf' &&
    kind !== 'epub' &&
    kind !== 'csv'
  ) {
    return null;
  }
  const path = id.slice(idx + 1);
  if (!path) return null;
  return { kind, path };
}
