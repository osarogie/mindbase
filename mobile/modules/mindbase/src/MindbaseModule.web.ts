import { registerWebModule, NativeModule } from 'expo';

class MindbaseNativeModule extends NativeModule {
  defaultVaultPath(): string {
    return '/tmp/mindbase-vault';
  }
  open(_vaultPath: string): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
  vaultSnapshot(): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
  getNote(_path: string): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
  saveNote(_path: string, _content: string): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
  deleteVaultItem(_kind: string, _path: string): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
  getDatabaseMarkdown(_name: string): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
  saveDatabaseMarkdown(_name: string, _content: string): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
  search(_query: string): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
  listOpenTasks(): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
  getCsvTable(_path: string): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
  readFilePayload(_path: string): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
  previewHtml(_path: string): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
  ensureDailyNote(_isoDate: string): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
  ensureWeeklyNote(): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
  noteHistory(_path: string, _limit: number): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
  noteAtRev(_path: string, _rev: string): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
  wysiwygPage(_path: string, _content: string): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
  htmlToMarkdown(_html: string): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
  aiChat(_body: string): Promise<string> {
    return Promise.reject(new Error('Mindbase is not available on web'));
  }
}

export default registerWebModule(MindbaseNativeModule, 'Mindbase');
