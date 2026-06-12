import { NativeModule, requireNativeModule } from 'expo';

declare class MindbaseNativeModule extends NativeModule {
  defaultVaultPath(): string;
  open(vaultPath: string): Promise<string>;
  vaultSnapshot(): Promise<string>;
  getNote(path: string): Promise<string>;
  saveNote(path: string, content: string): Promise<string>;
  deleteVaultItem(kind: string, path: string): Promise<string>;
  getDatabaseMarkdown(name: string): Promise<string>;
  saveDatabaseMarkdown(name: string, content: string): Promise<string>;
  search(query: string): Promise<string>;
  listOpenTasks(): Promise<string>;
  getCsvTable(path: string): Promise<string>;
  readFilePayload(path: string): Promise<string>;
  previewHtml(path: string): Promise<string>;
  ensureDailyNote(isoDate: string): Promise<string>;
  ensureWeeklyNote(): Promise<string>;
  noteHistory(path: string, limit: number): Promise<string>;
  noteAtRev(path: string, rev: string): Promise<string>;
  wysiwygPage(path: string, content: string): Promise<string>;
  htmlToMarkdown(html: string): Promise<string>;
  aiChat(body: string): Promise<string>;
}

const Native = requireNativeModule<MindbaseNativeModule>('Mindbase');

export function wysiwygNativeReady(): boolean {
  return typeof Native.wysiwygPage === 'function' && typeof Native.htmlToMarkdown === 'function';
}

export default Native;
