import { useCallback, useEffect, useState } from 'react';
import { useVault } from '../context/VaultContext';
import { useDebouncedEffect } from './useDebouncedEffect';
import type { Note } from 'mindbase';

export function useNote(path: string | null) {
  const { loadNote, saveNoteContent } = useVault();
  const [note, setNote] = useState<Note | null>(null);
  const [draft, setDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(Boolean(path));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!path) {
      setNote(null);
      setDraft('');
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
        setDraft(loaded.content);
        setDirty(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadNote, path]);

  const handleSave = useCallback(
    async (contentOverride?: string) => {
      if (!path || saving) return;
      const payload = contentOverride ?? draft;
      setSaving(true);
      try {
        const saved = await saveNoteContent(path, payload);
        setNote(saved);
        setDraft(saved.content);
        setDirty(false);
      } finally {
        setSaving(false);
      }
    },
    [draft, path, saveNoteContent, saving],
  );

  useDebouncedEffect(() => {
    if (dirty && path && !saving) {
      void handleSave();
    }
  }, [dirty, path, saving, draft, handleSave], 1800);

  return {
    note,
    draft,
    dirty,
    loading,
    saving,
    setDraft: (value: string) => {
      setDraft(value);
      setDirty(true);
    },
    saveNow: handleSave,
  };
}
