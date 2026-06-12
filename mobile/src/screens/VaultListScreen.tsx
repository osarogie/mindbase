import { usePathname, useRouter, useFocusEffect } from 'expo-router';
import { useMemo, useState, useCallback } from 'react';
import { Sidebar } from '../components/Sidebar';
import { useEditorTabs } from '../context/EditorTabsContext';
import { useVault } from '../context/VaultContext';
import { openEditor } from '../navigation/editorRoute';
import type { VaultItem } from 'mindbase';

export function VaultListScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { openTab } = useEditorTabs();
  const { vaultName, items, refreshing, loading, ready, error, clearError, refresh, createPage, openToday } =
    useVault();
  const [query, setQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      void refresh(true);
    }, [ready, refresh]),
  );

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q),
    );
  }, [items, query]);

  const openItem = (item: VaultItem) => {
    setSelectedPath(item.path);
    openTab(item.kind, item.path, item.title);
    openEditor(router, pathname);
  };

  const handleNewPage = async () => {
    const note = await createPage();
    openItem({
      id: note.path,
      kind: 'note',
      title: note.title,
      subtitle: note.path,
      path: note.path,
      folder: '',
      file_path: '',
      modified: note.modified,
    });
  };

  const handleToday = async () => {
    const note = await openToday();
    openItem({
      id: note.path,
      kind: 'note',
      title: note.title,
      subtitle: note.path,
      path: note.path,
      folder: '',
      file_path: '',
      modified: note.modified,
    });
  };

  return (
    <Sidebar
      vaultName={vaultName}
      items={filteredItems}
      selectedPath={selectedPath}
      query={query}
      refreshing={refreshing}
      loading={loading}
      error={error}
      onDismissError={clearError}
      showSearch
      onQueryChange={(value) => {
        setQuery(value);
        if (!value.trim()) void refresh(true);
      }}
      onSelect={openItem}
      onNewPage={() => void handleNewPage()}
      onToday={() => void handleToday()}
      onRefresh={() => void refresh()}
    />
  );
}
