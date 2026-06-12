import { Stack, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { useEditorTabs } from '../context/EditorTabsContext';
import { useVault } from '../context/VaultContext';
import { openEditor } from '../navigation/editorRoute';
import { colors } from '../theme';
import type { VaultItem } from 'mindbase';

export function SearchScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { openTab } = useEditorTabs();
  const { items, refreshing, loading, error, clearError, runSearch } = useVault();
  const [query, setQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const trimmedQuery = query.trim();
  const displayItems = useMemo(() => (trimmedQuery ? items : []), [items, trimmedQuery]);

  useEffect(() => {
    if (!trimmedQuery) return;
    const timer = setTimeout(() => {
      void runSearch(trimmedQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [trimmedQuery, runSearch]);

  const openItem = useCallback(
    (item: VaultItem) => {
      setSelectedPath(item.path);
      openTab(item.kind, item.path, item.title);
      openEditor(router, pathname);
    },
    [openTab, pathname, router],
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Search', headerLargeTitle: true }} />
      <Stack.SearchBar
        placeholder="Search vault"
        autoCapitalize="none"
        autoFocus
        hideWhenScrolling
        barTintColor={colors.surfaceMuted}
        textColor={colors.text}
        hintTextColor={colors.textMuted}
        tintColor={colors.accent}
        onChangeText={(event) => setQuery(event.nativeEvent.text)}
        onCancelButtonPress={() => setQuery('')}
      />
      <Sidebar
        vaultName=""
        items={displayItems}
        selectedPath={selectedPath}
        query={query}
        refreshing={refreshing}
        loading={loading}
        error={error}
        onDismissError={clearError}
        showSearch={false}
        useNativeHeader
        listVariant="search"
        onQueryChange={setQuery}
        onSelect={openItem}
        onNewPage={() => {}}
        onToday={() => {}}
        onRefresh={() => {
          if (trimmedQuery) void runSearch(trimmedQuery);
        }}
      />
    </>
  );
}
