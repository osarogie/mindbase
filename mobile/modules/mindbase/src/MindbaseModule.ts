import { NativeModule, requireNativeModule } from 'expo';

declare class MindbaseNativeModule extends NativeModule {
  defaultVaultPath(): string;
  open(vaultPath: string): Promise<string>;
  vaultSnapshot(): Promise<string>;
  getNote(path: string): Promise<string>;
  saveNote(path: string, content: string): Promise<string>;
  getDatabaseMarkdown(name: string): Promise<string>;
  saveDatabaseMarkdown(name: string, content: string): Promise<string>;
  search(query: string): Promise<string>;
  previewHtml(path: string): Promise<string>;
  ensureDailyNote(isoDate: string): Promise<string>;
  ensureWeeklyNote(): Promise<string>;
}

const Native = requireNativeModule<MindbaseNativeModule>('Mindbase');

export default Native;
