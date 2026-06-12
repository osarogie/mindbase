import * as Haptics from 'expo-haptics';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  defaultVaultPath,
  deleteVaultItem as deleteVaultItemNative,
  ensureDailyNote,
  getNote,
  listOpenTasks,
  open,
  saveNote,
  search,
  vaultSnapshot,
  type Note,
  type OpenTask,
  type VaultItem,
  type VaultItemKind,
} from 'mindbase';
import { newPagePath, todayISO } from '../utils/noteContent';
import { snapshotVaultItems } from '../utils/vaultItems';

interface VaultContextValue {
  vaultPath: string;
  vaultName: string;
  items: VaultItem[];
  openTasks: OpenTask[];
  openTaskCount: number;
  loading: boolean;
  refreshing: boolean;
  ready: boolean;
  error: string | null;
  clearError: () => void;
  refresh: (silent?: boolean) => Promise<void>;
  syncOpenTaskCount: () => Promise<void>;
  runSearch: (query: string) => Promise<VaultItem[]>;
  createPage: () => Promise<Note>;
  openToday: () => Promise<Note>;
  loadNote: (path: string) => Promise<Note>;
  saveNoteContent: (path: string, content: string) => Promise<Note>;
  deleteVaultItem: (kind: VaultItemKind, path: string) => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [vaultPath] = useState(() => defaultVaultPath());
  const [vaultName, setVaultName] = useState('');
  const [items, setItems] = useState<VaultItem[]>([]);
  const [openTasks, setOpenTasks] = useState<OpenTask[]>([]);
  const [openTaskCount, setOpenTaskCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openPromiseRef = useRef<Promise<void> | null>(null);

  const ensureOpen = useCallback(async () => {
    if (openPromiseRef.current) {
      await openPromiseRef.current;
      return;
    }

    openPromiseRef.current = (async () => {
      const info = await open(vaultPath);
      setVaultName(info.name);
      setReady(true);
    })();

    try {
      await openPromiseRef.current;
    } catch (e) {
      openPromiseRef.current = null;
      throw e;
    }
  }, [vaultPath]);

  const applyOpenTasks = useCallback((tasks: OpenTask[]) => {
    setOpenTasks(tasks);
    setOpenTaskCount(tasks.length);
  }, []);

  const fetchOpenTasks = useCallback(async () => {
    await ensureOpen();
    const tasks = await listOpenTasks();
    applyOpenTasks(tasks);
    return tasks;
  }, [applyOpenTasks, ensureOpen]);

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        await ensureOpen();
        const snap = await vaultSnapshot();
        setItems(snapshotVaultItems(snap));
        setVaultName(snap.info.name);
        try {
          await fetchOpenTasks();
        } catch {
          // Keep the last known task list if a refresh fails mid-flight.
        }
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [ensureOpen, fetchOpenTasks],
  );

  const syncOpenTaskCount = useCallback(async () => {
    try {
      await fetchOpenTasks();
    } catch {
      // Keep the last known task list if sync fails.
    }
  }, [fetchOpenTasks]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureOpen();
      await refresh(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [ensureOpen, refresh]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const runSearch = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) {
        await refresh(true);
        return [];
      }

      setLoading(true);
      setError(null);
      try {
        await ensureOpen();
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
        return mapped;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return [];
      } finally {
        setLoading(false);
      }
    },
    [ensureOpen, refresh],
  );

  const createPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureOpen();
      const path = newPagePath();
      const note = await saveNote(path, '# Untitled\n\n');
      await refresh(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return note;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, [ensureOpen, refresh]);

  const openToday = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureOpen();
      const path = await ensureDailyNote(todayISO());
      await refresh(true);
      return getNote(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, [ensureOpen, refresh]);

  const loadNote = useCallback(
    async (path: string) => {
      setError(null);
      await ensureOpen();
      return getNote(path);
    },
    [ensureOpen],
  );

  const saveNoteContent = useCallback(
    async (path: string, content: string) => {
      setError(null);
      try {
        await ensureOpen();
        const saved = await saveNote(path, content);
        setItems((prev) =>
          prev.map((item) =>
            item.kind === 'note' && item.path === path ? { ...item, title: saved.title } : item,
          ),
        );
        await refresh(true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return saved;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        throw e;
      }
    },
    [ensureOpen, refresh],
  );

  const deleteVaultItem = useCallback(
    async (kind: VaultItemKind, path: string) => {
      setError(null);
      try {
        await ensureOpen();
        await deleteVaultItemNative(kind, path);
        await refresh(true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        throw e;
      }
    },
    [ensureOpen, refresh],
  );

  const value = useMemo(
    () => ({
      vaultPath,
      vaultName,
      items,
      openTasks,
      openTaskCount,
      loading,
      refreshing,
      ready,
      error,
      clearError: () => setError(null),
      refresh,
      syncOpenTaskCount,
      runSearch,
      createPage,
      openToday,
      loadNote,
      saveNoteContent,
      deleteVaultItem,
    }),
    [
      vaultPath,
      vaultName,
      items,
      openTasks,
      openTaskCount,
      loading,
      refreshing,
      ready,
      error,
      refresh,
      syncOpenTaskCount,
      runSearch,
      createPage,
      openToday,
      loadNote,
      saveNoteContent,
      deleteVaultItem,
    ],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error('useVault must be used within VaultProvider');
  }
  return ctx;
}
