import type { Note, VaultItem, VaultItemKind } from 'mindbase';
import { formatModified, titleFromPath } from './noteContent';

export interface FileInfoDetails {
  title: string;
  kind: VaultItemKind;
  filename: string;
  vaultPath: string;
  folder: string;
  location: string;
  modified?: string;
}

function joinPath(root: string, ...parts: string[]): string {
  const trimmed = root.replace(/\/+$/, '');
  return [trimmed, ...parts.filter(Boolean)].join('/');
}

function filenameFromPath(path: string, kind: VaultItemKind): string {
  const base = path.split('/').pop() ?? path;
  if (kind === 'database' && !base.endsWith('.csv')) {
    return `${base}.csv`;
  }
  return base;
}

function absoluteLocation(
  vaultRoot: string,
  kind: VaultItemKind,
  vaultPath: string,
  filePath?: string,
): string {
  if (filePath && (filePath.startsWith('/') || filePath.includes(':'))) {
    return filePath;
  }
  if (kind === 'database') {
    const name = vaultPath.endsWith('.csv') ? vaultPath : `${vaultPath}.csv`;
    return joinPath(vaultRoot, 'databases', name);
  }
  return joinPath(vaultRoot, 'notes', vaultPath);
}

export function fileInfoFromVaultItem(item: VaultItem, vaultRoot: string): FileInfoDetails {
  const kind = item.kind;
  return {
    title: item.title,
    kind,
    filename: filenameFromPath(item.path, kind),
    vaultPath: item.path,
    folder: item.folder || 'Root',
    location: absoluteLocation(vaultRoot, kind, item.path, item.file_path),
    modified: item.modified ? formatModified(item.modified) : undefined,
  };
}

export function fileInfoFromNote(
  note: Pick<Note, 'path' | 'title' | 'folder' | 'modified'>,
  vaultRoot: string,
  kind: VaultItemKind = 'note',
): FileInfoDetails {
  const folder = note.folder || note.path.split('/').slice(0, -1).join('/') || 'Root';
  return {
    title: note.title?.trim() || titleFromPath(note.path),
    kind,
    filename: filenameFromPath(note.path, kind),
    vaultPath: note.path,
    folder: folder || 'Root',
    location: absoluteLocation(vaultRoot, kind, note.path),
    modified: note.modified ? formatModified(note.modified) : undefined,
  };
}

export function fileInfoFromTaskPath(
  path: string,
  title: string,
  vaultRoot: string,
): FileInfoDetails {
  return fileInfoFromNote({ path, title, folder: path.split('/').slice(0, -1).join('/'), modified: '' }, vaultRoot);
}
