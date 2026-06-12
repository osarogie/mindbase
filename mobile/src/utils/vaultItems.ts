import type { NoteEntry, VaultItem, VaultSnapshot } from 'mindbase';
import { resolveNoteTitle } from '../utils/noteContent';

/** Prefer note titles from snapshot metadata over stale vault item labels. */
export function vaultItemsWithNoteTitles(
  items: VaultItem[],
  notes: NoteEntry[],
): VaultItem[] {
  const titleByPath = new Map(notes.map((note) => [note.path, note.title]));
  return items.map((item) => {
    if (item.kind !== 'note') return item;
    const title = resolveNoteTitle(item.path, titleByPath.get(item.path) ?? item.title);
    return title === item.title ? item : { ...item, title };
  });
}

export function snapshotVaultItems(snap: VaultSnapshot): VaultItem[] {
  return vaultItemsWithNoteTitles(snap.vault_items, snap.notes);
}
