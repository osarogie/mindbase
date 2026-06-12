export type InsertAction =
  | { kind: 'block'; block: 'h3' | 'ordered' }
  | { kind: 'slash'; id: string };

export interface InsertMenuItem {
  label: string;
  action: InsertAction;
}

export const NOTE_INSERT_MENU: InsertMenuItem[] = [
  { label: 'Link', action: { kind: 'slash', id: 'link' } },
  { label: 'Wiki link', action: { kind: 'slash', id: 'wikilink' } },
  { label: 'Numbered list', action: { kind: 'block', block: 'ordered' } },
  { label: 'Table', action: { kind: 'slash', id: 'table' } },
  { label: 'Divider', action: { kind: 'slash', id: 'divider' } },
  { label: 'Tag', action: { kind: 'slash', id: 'tag' } },
  { label: 'Scheduled task', action: { kind: 'slash', id: 'scheduled' } },
  { label: 'Mermaid diagram', action: { kind: 'slash', id: 'mermaid' } },
];

export const DATABASE_INSERT_MENU: InsertMenuItem[] = [
  { label: 'Table row', action: { kind: 'slash', id: 'dbrow' } },
  { label: 'Link', action: { kind: 'slash', id: 'link' } },
  { label: 'Table', action: { kind: 'slash', id: 'table' } },
  { label: 'Divider', action: { kind: 'slash', id: 'divider' } },
];

export function insertMenuForKind(kind: 'note' | 'database'): InsertMenuItem[] {
  return kind === 'database' ? DATABASE_INSERT_MENU : NOTE_INSERT_MENU;
}
