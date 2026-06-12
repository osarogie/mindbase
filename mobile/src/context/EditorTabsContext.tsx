import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { editorTabId, parseEditorTabId, type EditorDocumentKind } from './editorTabId';

export interface EditorTab {
  id: string;
  kind: EditorDocumentKind;
  path: string;
  title: string;
  dirty: boolean;
}

interface EditorTabsContextValue {
  tabs: EditorTab[];
  activeId: string | null;
  openTab: (kind: EditorDocumentKind, path: string, title?: string) => void;
  closeTab: (id: string) => EditorTab[];
  setActiveTab: (id: string) => void;
  setTabMeta: (id: string, meta: Partial<Pick<EditorTab, 'title' | 'dirty'>>) => void;
}

const EditorTabsContext = createContext<EditorTabsContextValue | null>(null);

export { EditorTabsContext };

const MAX_TABS = 12;

export function EditorTabsProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const openTab = useCallback((kind: EditorDocumentKind, path: string, title?: string) => {
    const id = editorTabId(kind, path);
    const label = title?.trim() || path.split('/').pop()?.replace(/\.csv$/i, '') || path;
    setTabs((prev) => {
      const existing = prev.find((tab) => tab.id === id);
      if (existing) {
        if (label && label !== existing.title) {
          return prev.map((tab) => (tab.id === id ? { ...tab, title: label } : tab));
        }
        return prev;
      }
      const next = [...prev, { id, kind, path, title: label, dirty: false }];
      if (next.length <= MAX_TABS) return next;
      return [...next.slice(1), next[next.length - 1]];
    });
    setActiveId(id);
  }, []);

  const closeTab = useCallback((id: string) => {
    let nextTabs: EditorTab[] = [];
    setTabs((prev) => {
      nextTabs = prev.filter((tab) => tab.id !== id);
      return nextTabs;
    });
    setActiveId((current) => {
      if (current !== id) return current;
      return nextTabs[nextTabs.length - 1]?.id ?? null;
    });
    return nextTabs;
  }, []);

  const setActiveTab = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const setTabMeta = useCallback((id: string, meta: Partial<Pick<EditorTab, 'title' | 'dirty'>>) => {
    setTabs((prev) => {
      let changed = false;
      const next = prev.map((tab) => {
        if (tab.id !== id) return tab;
        let updated = tab;
        if (meta.title !== undefined && meta.title !== tab.title) {
          updated = { ...updated, title: meta.title };
        }
        if (meta.dirty !== undefined && meta.dirty !== tab.dirty) {
          updated = { ...updated, dirty: meta.dirty };
        }
        if (updated === tab) return tab;
        changed = true;
        return updated;
      });
      return changed ? next : prev;
    });
  }, []);

  const value = useMemo(
    () => ({
      tabs,
      activeId,
      openTab,
      closeTab,
      setActiveTab,
      setTabMeta,
    }),
    [tabs, activeId, openTab, closeTab, setActiveTab, setTabMeta],
  );

  return <EditorTabsContext.Provider value={value}>{children}</EditorTabsContext.Provider>;
}

export function useEditorTabs() {
  const ctx = useContext(EditorTabsContext);
  if (!ctx) {
    throw new Error('useEditorTabs must be used within EditorTabsProvider');
  }
  return ctx;
}

export { parseEditorTabId };
