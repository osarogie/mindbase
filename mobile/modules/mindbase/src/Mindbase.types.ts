export interface VaultInfo {
  name: string;
  path: string;
  note_count: number;
  database_count: number;
}

export interface NoteEntry {
  path: string;
  title: string;
  folder: string;
  modified: string;
}

export interface DatabaseEntry {
  name: string;
  path: string;
  row_count: number;
  modified: string;
}

export interface VaultItem {
  id: string;
  kind: 'note' | 'database';
  title: string;
  subtitle: string;
  path: string;
  folder: string;
  file_path: string;
  modified: string;
}

export interface FolderSection {
  name: string;
  items: VaultItem[];
}

export interface JournalDayLink {
  date: string;
  path: string;
  title: string;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface VaultSnapshot {
  info: VaultInfo;
  notes: NoteEntry[];
  databases: DatabaseEntry[];
  vault_items: VaultItem[];
  folder_sections: FolderSection[];
  journal_days: JournalDayLink[];
  popular_tags: TagCount[];
  open_task_count: number;
}

export interface Note {
  path: string;
  title: string;
  content: string;
  folder: string;
  modified: string;
}

export interface HistoryCommit {
  hash: string;
  short: string;
  date: string;
  subject: string;
  source?: string;
}

export interface NoteHistory {
  path: string;
  has_git: boolean;
  has_repo: boolean;
  source: string;
  commits: HistoryCommit[];
}

export interface NoteRevision {
  path: string;
  rev: string;
  content: string;
}

export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
}
