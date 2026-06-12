import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useVault } from '../context/VaultContext';
import { EditorTabsContext } from '../context/EditorTabsContext';
import { noteTabId } from '../context/editorTabId';
import { extractTitle, titleFromPath } from '../utils/noteContent';
import { useDebouncedEffect } from './useDebouncedEffect';
import type { Note } from 'mindbase';

interface UseNoteOptions {
  /** Sync dirty/title into the multi-tab editor bar (editor workspace only). */
  syncTabMeta?: boolean;
}

export function useNote(path: string | null, options: UseNoteOptions = {}) {
  const { syncTabMeta = false } = options;
  const { loadNote, saveNoteContent } = useVault();
  const tabsCtx = useContext(EditorTabsContext);
  const setTabMetaRef = useRef(tabsCtx?.setTabMeta);
  setTabMetaRef.current = tabsCtx?.setTabMeta;

  const patchTabMeta = useCallback(
    (meta: Partial<{ title: string; dirty: boolean }>) => {
      if (!syncTabMeta || !path) return;
      setTabMetaRef.current?.(noteTabId(path), meta);
    },
    [path, syncTabMeta],
  );

  const [note, setNote] = useState<Note | null>(null);
  const [draft, setDraftState] = useState('');
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(Boolean(path));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!path) {
      setNote(null);
      setDraftState('');
      setDirty(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void loadNote(path)
      .then((loaded) => {
        if (cancelled) return;
        setNote(loaded);
        setDraftState(loaded.content);
        setDirty(false);
        patchTabMeta({ title: loaded.title, dirty: false });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadNote, patchTabMeta, path]);

  const handleSave = useCallback(
    async (contentOverride?: string) => {
      if (!path || saving) return;
      const payload = contentOverride ?? draft;
      setSaving(true);
      try {
        const saved = await saveNoteContent(path, payload);
        setNote(saved);
        setDraftState(saved.content);
        setDirty(false);
        patchTabMeta({ title: saved.title, dirty: false });
      } finally {
        setSaving(false);
      }
    },
    [draft, patchTabMeta, path, saveNoteContent, saving],
  );

  useDebouncedEffect(() => {
    if (dirty && path && !saving) {
      void handleSave();
    }
  }, [dirty, path, saving, draft, handleSave], 1800);

  const setDraft = useCallback(
    (value: string) => {
      setDraftState(value);
      setDirty(true);
      patchTabMeta({ dirty: true, title: extractTitle(value, titleFromPath(path ?? 'Untitled')) });
    },
    [path, patchTabMeta],
  );

  return {
    note,
    draft,
    dirty,
    loading,
    saving,
    setDraft,
    saveNow: handleSave,
  };
}
