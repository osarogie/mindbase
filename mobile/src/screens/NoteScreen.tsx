import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NoteEditor, type NoteEditorHandle } from '../components/NoteEditor';
import { useNote } from '../hooks/useNote';
import { colors, spacing } from '../theme';

interface Props {
  path: string;
  showBack?: boolean;
}

export function NoteScreen({ path, showBack = true }: Props) {
  const router = useRouter();
  const editorRef = useRef<NoteEditorHandle>(null);
  const { note, draft, dirty, loading, saving, setDraft, saveNow } = useNote(path);

  const handleBack = () => {
    if (!showBack) return;
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
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
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
