import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { ErrorBanner } from '../components/ErrorBanner';
import { NoteEditor } from '../components/NoteEditor';
import { SafeTopSpacer } from '../components/SafeTopSpacer';
import { useVault } from '../context/VaultContext';
import { useNote } from '../hooks/useNote';
import { colors, spacing, typography } from '../theme';

export function JournalScreen() {
  const { openToday, ready, error, clearError } = useVault();
  const [path, setPath] = useState<string | null>(null);
  const { note, draft, dirty, loading, saving, setDraft, saveNow } = useNote(path);

  useEffect(() => {
    if (!ready) return;
    void openToday()
      .then((note) => setPath(note.path))
      .catch(() => {});
  }, [openToday, ready]);

  if (!path || loading || !note) {
    return (
      <View style={styles.loading}>
        <SafeTopSpacer />
        {error ? <ErrorBanner message={error} onDismiss={clearError} /> : null}
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Opening today&apos;s journal…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {error ? <ErrorBanner message={error} onDismiss={clearError} /> : null}
      <NoteEditor
        note={note}
        content={draft}
        dirty={dirty}
        saving={saving}
        includeTopInset
        onChange={setDraft}
        onSave={() => void saveNow()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.screen,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
