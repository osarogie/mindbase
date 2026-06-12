import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NoteEditor, type NoteEditorHandle } from '../components/NoteEditor';
import { useNote } from '../hooks/useNote';
import { useVault } from '../context/VaultContext';
import { useEditorTabs } from '../context/EditorTabsContext';
import { editorTabId } from '../context/editorTabId';
import { colors, spacing } from '../theme';

interface Props {
  path: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function NoteScreen({ path, showBack = true, onBack }: Props) {
  const router = useRouter();
  const editorRef = useRef<NoteEditorHandle>(null);
  const { deleteVaultItem } = useVault();
  const { closeTab } = useEditorTabs();
  const { note, draft, dirty, loading, saving, setDraft, saveNow } = useNote(path, { syncTabMeta: true });

  const handleBack = () => {
    if (!showBack) return;
    if (onBack) {
      onBack();
      return;
    }
    if (dirty) {
      Alert.alert('Unsaved changes', 'Save before leaving this page?', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => router.back(),
        },
        {
          text: 'Save',
          onPress: () => {
            void editorRef.current?.saveWithFlush().then(() => router.back());
          },
        },
      ]);
      return;
    }
    router.back();
  };

  const handleDelete = () => {
    const title = note?.title || path;
    Alert.alert('Delete page', `Delete "${title}" permanently?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteVaultItem('note', path);
            closeTab(editorTabId('note', path));
            if (showBack) {
              if (onBack) onBack();
              else router.back();
            }
          })();
        },
      },
    ]);
  };

  if (loading || !note) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
      <NoteEditor
        ref={editorRef}
        note={note}
        content={draft}
        dirty={dirty}
        saving={saving}
        includeTopInset={false}
        onBack={showBack ? handleBack : undefined}
        onChange={setDraft}
        onSave={(content) => saveNow(content)}
        onDelete={handleDelete}
      />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
});
