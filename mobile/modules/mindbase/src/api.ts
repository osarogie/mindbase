import Native from './MindbaseModule';
import type {
  AIChatRequest,
  AIChatResponse,
  Note,
  NoteHistory,
  NoteRevision,
  SearchResult,
  OpenTask,
  CSVTable,
  FilePayload,
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

export { wysiwygNativeReady } from './MindbaseModule';

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

export async function deleteVaultItem(kind: string, path: string): Promise<void> {
  parseJSON(await Native.deleteVaultItem(kind, path));
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

export async function listOpenTasks(): Promise<OpenTask[]> {
  return parseJSON(await Native.listOpenTasks());
}

export async function getCsvTable(path: string): Promise<CSVTable> {
  return parseJSON(await Native.getCsvTable(path));
}

export async function readFilePayload(path: string): Promise<FilePayload> {
  return parseJSON(await Native.readFilePayload(path));
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

export async function noteHistory(path: string, limit = 30): Promise<NoteHistory> {
  return parseJSON(await Native.noteHistory(path, limit));
}

export async function noteAtRev(path: string, rev: string): Promise<NoteRevision> {
  return parseJSON(await Native.noteAtRev(path, rev));
}

export async function wysiwygPage(path: string, content: string): Promise<string> {
  if (typeof Native.wysiwygPage !== 'function') {
    throw new MindbaseError(
      'wysiwygPage native method missing — rebuild dev client: make libmindbase && cd mobile && bun ios',
    );
  }
  const payload = parseJSON<{ html: string }>(await Native.wysiwygPage(path, content));
  return payload.html;
}

export async function htmlToMarkdown(html: string): Promise<string> {
  if (typeof Native.htmlToMarkdown !== 'function') {
    throw new MindbaseError(
      'htmlToMarkdown native method missing — rebuild dev client: make libmindbase && cd mobile && bun ios',
    );
  }
  const payload = parseJSON<{ markdown: string }>(await Native.htmlToMarkdown(html));
  return payload.markdown;
}

export async function aiChat(req: AIChatRequest): Promise<AIChatResponse> {
  if (typeof Native.aiChat !== 'function') {
    throw new MindbaseError(
      'aiChat native method missing — rebuild dev client: make libmindbase && cd mobile && bun ios',
    );
  }
  return parseJSON(await Native.aiChat(JSON.stringify(req)));
}
