import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getDatabaseMarkdown, saveDatabaseMarkdown } from 'mindbase';
import { EditorTabsContext } from '../context/EditorTabsContext';
import { useVault } from '../context/VaultContext';
import { useDebouncedEffect } from './useDebouncedEffect';
import { databaseTabId } from '../context/editorTabId';
import { extractTitle, titleFromPath } from '../utils/noteContent';

interface UseDatabaseOptions {
  syncTabMeta?: boolean;
}

export function useDatabase(name: string | null, options: UseDatabaseOptions = {}) {
  const { syncTabMeta = false } = options;
  const { refresh } = useVault();
  const tabsCtx = useContext(EditorTabsContext);
  const setTabMetaRef = useRef(tabsCtx?.setTabMeta);
  setTabMetaRef.current = tabsCtx?.setTabMeta;

  const patchTabMeta = useCallback(
    (meta: Partial<{ title: string; dirty: boolean }>) => {
      if (!syncTabMeta || !name) return;
      setTabMetaRef.current?.(databaseTabId(name), meta);
    },
    [name, syncTabMeta],
  );

  const [title, setTitle] = useState('');
  const [draft, setDraftState] = useState('');
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(Boolean(name));
  const [saving, setSaving] = useState(false);

  const resolveTitle = useCallback(
    (content: string) => extractTitle(content, titleFromPath(name ?? 'database')),
    [name],
  );

  useEffect(() => {
    if (!name) {
      setTitle('');
      setDraftState('');
      setDirty(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void getDatabaseMarkdown(name)
      .then((content) => {
        if (cancelled) return;
        const label = resolveTitle(content);
        setTitle(label);
        setDraftState(content);
        setDirty(false);
        patchTabMeta({ title: label, dirty: false });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [name, patchTabMeta, resolveTitle]);

  const handleSave = useCallback(
    async (contentOverride?: string) => {
      if (!name || saving) return;
      const payload = contentOverride ?? draft;
      setSaving(true);
      try {
        await saveDatabaseMarkdown(name, payload);
        const label = resolveTitle(payload);
        setTitle(label);
        setDraftState(payload);
        setDirty(false);
        patchTabMeta({ title: label, dirty: false });
        await refresh(true);
      } finally {
        setSaving(false);
      }
    },
    [draft, name, patchTabMeta, refresh, resolveTitle, saving],
  );

  useDebouncedEffect(() => {
    if (dirty && name && !saving) {
      void handleSave();
    }
  }, [dirty, name, saving, draft, handleSave], 1800);

  const setDraft = useCallback(
    (value: string) => {
      setDraftState(value);
      setDirty(true);
      patchTabMeta({ dirty: true, title: resolveTitle(value) });
    },
    [patchTabMeta, resolveTitle],
  );

  return {
    name,
    title,
    draft,
    dirty,
    loading,
    saving,
    setDraft,
    saveNow: handleSave,
  };
}
