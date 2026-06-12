import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { useVault } from '../context/VaultContext';
import { notePathToSegments } from '../navigation/notePath';
import type { VaultItem } from 'mindbase';

interface Props {
  mode: 'library' | 'search';
}

export function VaultListScreen({ mode }: Props) {
  const router = useRouter();
  const { vaultName, items, refreshing, loading, ready, error, clearError, refresh, runSearch, createPage, openToday } =
    useVault();
  const [query, setQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'search' || !ready) return;
    const timer = setTimeout(() => {
      void runSearch(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [mode, query, ready, runSearch]);

  const filteredItems = useMemo(() => {
    if (mode === 'search') return items;
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q),
    );
  }, [items, mode, query]);

  const openItem = (item: VaultItem) => {
    if (item.kind !== 'note') return;
    setSelectedPath(item.path);
    const base = mode === 'search' ? '/(tabs)/(search)/note/[...path]' : '/(tabs)/(library)/note/[...path]';
    router.push({
      pathname: base,
      params: { path: notePathToSegments(item.path) },
    });
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
      showSearch={mode === 'search' || mode === 'library'}
      searchAutoFocus={mode === 'search'}
      onQueryChange={(value) => {
        setQuery(value);
        if (mode !== 'search' && !value.trim()) void refresh(true);
      }}
      onSelect={openItem}
      onNewPage={() => void handleNewPage()}
      onToday={() => void handleToday()}
      onRefresh={() => void refresh()}
    />
  );
}
