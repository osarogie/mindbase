import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import {
  defaultVaultPath,
  ensureDailyNote,
  getNote,
  open,
  saveNote,
  search,
  vaultSnapshot,
  type Note,
  type VaultItem,
} from 'mindbase';
import { Sidebar } from './Sidebar';
import { NoteEditor } from './NoteEditor';
import { EmptyState } from './EmptyState';
import { newPagePath, todayISO } from '../utils/noteContent';
import { useDebouncedEffect } from '../hooks/useDebouncedEffect';
import { colors, spacing } from '../theme';

type Screen = 'list' | 'editor';

export function VaultApp() {
  const { width } = useWindowDimensions();
  const isWide = width >= 820;

  const [vaultPath] = useState(() => defaultVaultPath());
  const [vaultName, setVaultName] = useState('');
  const [items, setItems] = useState<VaultItem[]>([]);
  const [query, setQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [draft, setDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const [screen, setScreen] = useState<Screen>('list');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const snap = await vaultSnapshot();
      setItems(snap.vault_items);
      setVaultName(snap.info.name);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await open(vaultPath);
      setVaultName(info.name);
      await refresh(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [refresh, vaultPath]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

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

  const openItem = useCallback(async (item: VaultItem) => {
    if (item.kind !== 'note') return;
    setLoading(true);
    setError(null);
    try {
      const note = await getNote(item.path);
      setSelectedPath(item.path);
      setSelectedNote(note);
      setDraft(note.content);
      setDirty(false);
      setScreen('editor');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedNote || saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveNote(selectedNote.path, draft);
      setSelectedNote(saved);
      setDraft(saved.content);
      setDirty(false);
      await refresh(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }, [draft, refresh, saving, selectedNote]);

  useDebouncedEffect(() => {
    if (dirty && selectedNote && !saving) {
      void handleSave();
    }
  }, [dirty, selectedNote, saving, draft, handleSave], 1800);

  const handleNewPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const path = newPagePath();
      const content = '# Untitled\n\n';
      const note = await saveNote(path, content);
      await refresh(true);
      setSelectedPath(note.path);
      setSelectedNote(note);
      setDraft(note.content);
      setDirty(false);
      setScreen('editor');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const handleToday = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const path = await ensureDailyNote(todayISO());
      await refresh(true);
      await openItem({
        id: path,
        kind: 'note',
        title: 'Today',
        subtitle: path,
        path,
        folder: '',
        file_path: '',
        modified: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [openItem, refresh]);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) {
      await refresh(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await search(q);
      const mapped: VaultItem[] = results.map((result) => ({
        id: result.path,
        kind: 'note',
        title: result.title,
        subtitle: result.snippet,
        path: result.path,
        folder: '',
        file_path: '',
        modified: '',
      }));
      setItems(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [query, refresh]);

  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      void runSearch();
    }, 350);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const handleBack = useCallback(() => {
    if (dirty) {
      Alert.alert('Unsaved changes', 'Save before leaving this page?', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setDirty(false);
            setScreen('list');
          },
        },
        {
          text: 'Save',
          onPress: () => {
            void handleSave().then(() => setScreen('list'));
          },
        },
      ]);
      return;
    }
    setScreen('list');
  }, [dirty, handleSave]);

  const showSidebar = isWide || screen === 'list';
  const showEditor = isWide || screen === 'editor';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText} numberOfLines={2}>
            {error}
          </Text>
          <Pressable onPress={() => setError(null)} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.danger} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.body}>
        {showSidebar ? (
          <View style={[styles.sidebar, !isWide && styles.sidebarFull]}>
            <Sidebar
              vaultName={vaultName}
              items={filteredItems}
              selectedPath={selectedPath}
              query={query}
              refreshing={refreshing}
              showFab={!isWide}
              onQueryChange={(value) => {
                setQuery(value);
                if (!value.trim()) void refresh(true);
              }}
              onSelect={(item) => void openItem(item)}
              onNewPage={() => void handleNewPage()}
              onToday={() => void handleToday()}
              onRefresh={() => void refresh()}
            />
          </View>
        ) : null}

        {showEditor ? (
          <View style={styles.editorPane}>
            {selectedNote ? (
              <NoteEditor
                note={selectedNote}
                content={draft}
                dirty={dirty}
                saving={saving}
                onBack={!isWide ? handleBack : undefined}
                onChange={(value) => {
                  setDraft(value);
                  setDirty(true);
                }}
                onSave={() => void handleSave()}
              />
            ) : (
              <EmptyState
                title="Your workspace is ready"
                body="Pick a page from the sidebar or start a fresh note. Everything saves to your local vault."
                actionLabel="New page"
                onAction={() => void handleNewPage()}
              />
            )}
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  errorBar: {
    backgroundColor: '#FDEDED',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    flex: 1,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 320,
    maxWidth: '42%',
  },
  sidebarFull: {
    width: '100%',
    maxWidth: '100%',
  },
  editorPane: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(251, 251, 250, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
