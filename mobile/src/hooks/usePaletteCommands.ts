import { usePathname, useRouter } from 'expo-router';
import { useMemo } from 'react';
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import { useCommandPalette } from '../context/CommandPaletteContext';
import { useEditorTabs } from '../context/EditorTabsContext';
import { useVault } from '../context/VaultContext';
import { openEditor } from '../navigation/editorRoute';
import type { VaultItem } from 'mindbase';

export interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  keywords?: string[];
  run: () => void | Promise<void>;
}

export function usePaletteCommands(): PaletteCommand[] {
  const router = useRouter();
  const pathname = usePathname();
  const { closePalette } = useCommandPalette();
  const { openTab } = useEditorTabs();
  const { items, createPage, openToday } = useVault();

  return useMemo(() => {
    const openItem = (item: VaultItem) => {
      closePalette();
      openTab(item.kind, item.path, item.title);
      openEditor(router, pathname);
    };

    const nav = (path: string) => {
      closePalette();
      router.push(path as '/editor');
    };

    const commands: PaletteCommand[] = [
      {
        id: 'nav-library',
        label: 'Go to Library',
        hint: 'Browse vault',
        icon: 'library-outline',
        keywords: ['home', 'browse'],
        run: () => nav('/(tabs)/(library)'),
      },
      {
        id: 'nav-inbox',
        label: 'Open inbox',
        hint: 'Open tasks',
        icon: 'checkbox-outline',
        keywords: ['tasks', 'todo', 'inbox'],
        run: () => nav('/(tabs)/(inbox)'),
      },
      {
        id: 'nav-search',
        label: 'Search vault',
        hint: 'Full-text search',
        icon: 'search-outline',
        keywords: ['find'],
        run: () => nav('/(tabs)/(search)'),
      },
      {
        id: 'nav-settings',
        label: 'Settings',
        hint: 'Vault and app',
        icon: 'settings-outline',
        keywords: ['preferences', 'config'],
        run: () => nav('/(tabs)/(settings)'),
      },
      {
        id: 'action-new',
        label: 'New note',
        hint: 'Create page',
        icon: 'add-outline',
        keywords: ['create'],
        run: async () => {
          closePalette();
          const note = await createPage();
          openTab('note', note.path, note.title);
          openEditor(router, pathname);
        },
      },
      {
        id: 'action-today',
        label: 'Open today’s note',
        hint: 'Daily note',
        icon: 'today-outline',
        keywords: ['journal', 'daily', 'today'],
        run: async () => {
          closePalette();
          const note = await openToday();
          openTab('note', note.path, note.title);
          openEditor(router, pathname);
        },
      },
    ];

    for (const item of items) {
      commands.push({
        id: `${item.kind}:${item.path}`,
        label: item.title,
        hint: item.path,
        icon: item.kind === 'database' ? 'grid-outline' : 'document-text-outline',
        keywords: [item.path, item.folder, item.subtitle].filter(Boolean),
        run: () => openItem(item),
      });
    }

    return commands;
  }, [closePalette, createPage, items, openTab, openToday, pathname, router]);
}

export function filterPaletteCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands.slice(0, 24);
  return commands
    .filter((cmd) => {
      const hay = [cmd.label, cmd.hint, ...(cmd.keywords ?? [])].join(' ').toLowerCase();
      return hay.includes(q) || q.split(/\s+/).every((part) => hay.includes(part));
    })
    .slice(0, 24);
}
