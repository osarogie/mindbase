import Native from './MindbaseModule';
import type {
  Note,
  SearchResult,
  VaultInfo,
  VaultSnapshot,
} from './Mindbase.types';

class MindbaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MindbaseError';
  }
}

function parseJSON<T>(json: string): T {
  const data = JSON.parse(json) as T & { error?: string };
  if (typeof data === 'object' && data !== null && 'error' in data && data.error) {
    throw new MindbaseError(data.error);
  }
  return data;
}

export function defaultVaultPath(): string {
  return Native.defaultVaultPath();
}

export async function open(vaultPath: string): Promise<VaultInfo> {
  return parseJSON(await Native.open(vaultPath));
}

export async function vaultSnapshot(): Promise<VaultSnapshot> {
  return parseJSON(await Native.vaultSnapshot());
}

export async function getNote(path: string): Promise<Note> {
  return parseJSON(await Native.getNote(path));
}

export async function saveNote(path: string, content: string): Promise<Note> {
  return parseJSON(await Native.saveNote(path, content));
}

export async function getDatabaseMarkdown(name: string): Promise<string> {
  const payload = parseJSON<{ content: string }>(await Native.getDatabaseMarkdown(name));
  return payload.content;
}

export async function saveDatabaseMarkdown(name: string, content: string): Promise<void> {
  parseJSON(await Native.saveDatabaseMarkdown(name, content));
}

export async function search(query: string): Promise<SearchResult[]> {
  return parseJSON(await Native.search(query));
}

export async function previewHtml(path: string): Promise<string> {
  const payload = parseJSON<{ html: string }>(await Native.previewHtml(path));
  return payload.html;
}

export async function ensureDailyNote(isoDate: string): Promise<string> {
  const payload = parseJSON<{ path: string }>(await Native.ensureDailyNote(isoDate));
  return payload.path;
}

export async function ensureWeeklyNote(): Promise<string> {
  const payload = parseJSON<{ path: string }>(await Native.ensureWeeklyNote());
  return payload.path;
}
