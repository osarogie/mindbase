import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import type { OpenTask } from 'mindbase';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import { FileInfoPanel } from '../components/FileInfoPanel';
import { OverflowMenuButton } from '../components/OverflowMenuButton';
import { useEditorTabs } from '../context/EditorTabsContext';
import { useVault } from '../context/VaultContext';
import { openEditor } from '../navigation/editorRoute';
import { fileInfoFromTaskPath, type FileInfoDetails } from '../utils/fileInfo';
import { colors, hairlineBorder, radii, softShadow, spacing, typography } from '../theme';

function TaskRow({
  task,
  onPress,
  onShowInfo,
}: {
  task: OpenTask;
  onPress: () => void;
  onShowInfo: (task: OpenTask) => void;
}) {
  const openContextMenu = () => {
    Alert.alert(task.text, undefined, [
      { text: 'Open note', onPress: () => onPress() },
      { text: 'File info', onPress: () => onShowInfo(task) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={openContextMenu}
      delayLongPress={320}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.checkWrap}>
        <Ionicons name="square-outline" size={18} color={colors.textMuted} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.taskText} numberOfLines={2}>
          {task.text}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.noteTitle} numberOfLines={1}>
            {task.note_title}
          </Text>
          {task.schedule ? (
            <View style={styles.scheduleBadge}>
              <Text style={styles.scheduleText}>{task.schedule}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <OverflowMenuButton
        title={task.note_title}
        actions={[{ label: 'File info', onPress: () => onShowInfo(task) }]}
        accessibilityLabel={`More options for ${task.note_title}`}
      />
      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
    </Pressable>
  );
}

export function InboxScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { openTab } = useEditorTabs();
  const {
    vaultPath,
    openTasks,
    ready,
    loading,
    refreshing,
    error,
    clearError,
    refresh,
    syncOpenTaskCount,
  } = useVault();
  const [fileInfo, setFileInfo] = useState<FileInfoDetails | null>(null);

  const syncInbox = useCallback(async () => {
    if (!ready) return;
    await syncOpenTaskCount();
  }, [ready, syncOpenTaskCount]);

  useEffect(() => {
    void syncInbox();
  }, [syncInbox]);

  useFocusEffect(
    useCallback(() => {
      void syncInbox();
    }, [syncInbox]),
  );

  const handleRefresh = useCallback(async () => {
    await refresh(true);
    await syncInbox();
  }, [refresh, syncInbox]);

  const openTask = (task: OpenTask) => {
    openTab('note', task.path, task.note_title);
    openEditor(router, pathname);
  };

  const showFileInfo = useCallback(
    (task: OpenTask) => {
      setFileInfo(fileInfoFromTaskPath(task.path, task.note_title, vaultPath));
    },
    [vaultPath],
  );

  const waitingForTasks = !ready || (loading && openTasks.length === 0);

  return (
    <View style={styles.screen}>
      {error ? <ErrorBanner message={error} onDismiss={clearError} /> : null}
      <FlatList
        data={openTasks}
        keyExtractor={(item) => `${item.path}:${item.line}`}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
        ListHeaderComponent={
          openTasks.length > 0 ? (
            <Text style={styles.hint}>
              Open tasks from `- [ ]` checkboxes across your vault
            </Text>
          ) : null
        }
        ListEmptyComponent={
          waitingForTasks ? (
            <View style={styles.spinnerWrap}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <EmptyState
              title="Inbox is clear"
              body="No open tasks. Add `- [ ]` items in any note to see them here."
            />
          )
        }
        renderItem={({ item }) => (
          <TaskRow task={item} onPress={() => openTask(item)} onShowInfo={showFileInfo} />
        )}
        contentContainerStyle={[styles.listContent, openTasks.length === 0 && styles.listEmpty]}
      />
      <FileInfoPanel visible={fileInfo != null} details={fileInfo} onClose={() => setFileInfo(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  listEmpty: {
    // flexGrow: 1,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  spinnerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...hairlineBorder(colors.border),
    ...softShadow(),
  },
  rowPressed: {
    opacity: 0.82,
  },
  checkWrap: {
    width: 24,
    alignItems: 'center',
  },
  rowBody: {
    flex: 1,
    gap: spacing.xs,
  },
  taskText: {
    ...typography.body,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  noteTitle: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  scheduleBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  scheduleText: {
    ...typography.micro,
    color: colors.accent,
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 11,
  },
});
