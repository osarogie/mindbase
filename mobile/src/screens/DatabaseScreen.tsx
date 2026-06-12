import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NoteEditor, type NoteEditorHandle } from '../components/NoteEditor';
import { useDatabase } from '../hooks/useDatabase';
import { useVault } from '../context/VaultContext';
import { useEditorTabs } from '../context/EditorTabsContext';
import { editorTabId } from '../context/editorTabId';
import { colors, spacing } from '../theme';

interface Props {
  name: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function DatabaseScreen({ name, showBack = true, onBack }: Props) {
  const router = useRouter();
  const editorRef = useRef<NoteEditorHandle>(null);
  const { deleteVaultItem } = useVault();
  const { closeTab } = useEditorTabs();
  const { title, draft, dirty, loading, saving, setDraft, saveNow } = useDatabase(name, {
    syncTabMeta: true,
  });

  const leave = onBack ?? (() => router.back());

  const handleBack = () => {
    if (!showBack) return;
    if (dirty) {
      Alert.alert('Unsaved changes', 'Save before leaving this database?', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: leave },
        {
          text: 'Save',
          onPress: () => {
            void editorRef.current?.saveWithFlush().then(leave);
          },
        },
      ]);
      return;
    }
    leave();
  };

  const handleDelete = () => {
    const label = title || name;
    Alert.alert('Delete database', `Delete "${label}" permanently?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteVaultItem('database', name);
            closeTab(editorTabId('database', name));
            leave();
          })();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const note = {
    path: name,
    title: title || name,
    content: draft,
    folder: 'databases',
    modified: '',
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <NoteEditor
        ref={editorRef}
        note={note}
        content={draft}
        dirty={dirty}
        saving={saving}
        documentKind="database"
        includeTopInset={false}
        onBack={showBack ? handleBack : undefined}
        onChange={setDraft}
        onSave={(content) => saveNow(content)}
        onDelete={handleDelete}
      />
    </SafeAreaView>
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
