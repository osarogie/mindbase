import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { noteAtRev, noteHistory } from 'mindbase';
import type { HistoryCommit } from 'mindbase';
import { colors, radii, spacing, typography } from '../theme';
import { formatHistoryDate } from '../utils/noteContent';
import { useEffectiveBottomInset } from '../hooks/useSafeTopPadding';
import { SafeTopSpacer } from './SafeTopSpacer';

interface Props {
  path: string;
  visible: boolean;
  onClose: () => void;
  onRestore: (content: string) => void;
}

export function HistoryPanel({ path, visible, onClose, onRestore }: Props) {
  const bottomInset = useEffectiveBottomInset();
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [commits, setCommits] = useState<HistoryCommit[]>([]);
  const [source, setSource] = useState('');
  const [selected, setSelected] = useState<HistoryCommit | null>(null);
  const [preview, setPreview] = useState('');

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const hist = await noteHistory(path, 40);
      setCommits(hist.commits);
      setSource(hist.source);
      setSelected(null);
      setPreview('');
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (visible) void loadHistory();
  }, [visible, loadHistory]);

  const previewCommit = async (commit: HistoryCommit) => {
    setSelected(commit);
    setPreviewLoading(true);
    try {
      const rev = await noteAtRev(path, commit.hash);
      setPreview(rev.content);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <SafeTopSpacer backgroundColor={colors.surfaceElevated} />
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Version history</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {source === 'git' ? 'Git commits' : 'Local snapshots'} · {path}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : commits.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No saved versions yet</Text>
            <Text style={styles.empty}>Edits are tracked automatically when you save.</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xxl + bottomInset }]}
          >
            {commits.map((commit) => {
              const active = selected?.hash === commit.hash;
              return (
                <Pressable
                  key={commit.hash}
                  onPress={() => void previewCommit(commit)}
                  style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && styles.rowPressed]}
                >
                  <View style={styles.rowBody}>
                    <Text style={styles.subject} numberOfLines={2}>
                      {commit.subject}
                    </Text>
                    <Text style={styles.meta}>
                      <Text style={styles.hash}>{commit.short}</Text>
                      {' · '}
                      {formatHistoryDate(commit.date)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                </Pressable>
              );
            })}

            {selected ? (
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>Preview at {selected.short}</Text>
                {previewLoading ? (
                  <ActivityIndicator color={colors.accent} style={styles.previewLoader} />
                ) : (
                  <Text style={styles.previewText} selectable>
                    {preview.slice(0, 1200)}
                    {preview.length > 1200 ? '…' : ''}
                  </Text>
                )}
                <Pressable
                  disabled={previewLoading || !preview}
                  onPress={() => {
                    onRestore(preview);
                    onClose();
                  }}
                  style={({ pressed }) => [styles.restoreBtn, pressed && styles.restoreBtnPressed]}
                >
                  <Ionicons name="arrow-undo-outline" size={16} color="#fff" />
                  <Text style={styles.restoreText}>Restore this version</Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.headline,
    fontSize: 18,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  closeBtn: {
    padding: spacing.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.headline,
    color: colors.text,
  },
  empty: {
    ...typography.body,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.screen,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowActive: {
    borderColor: colors.accentSoft,
    backgroundColor: colors.surface,
  },
  rowPressed: {
    opacity: 0.9,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  subject: {
    ...typography.body,
    fontSize: 15,
    color: colors.text,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  hash: {
    fontFamily: 'Menlo',
    fontSize: 11,
  },
  previewCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.md,
  },
  previewLabel: {
    ...typography.micro,
    color: colors.textMuted,
  },
  previewText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    fontFamily: 'Menlo',
  },
  previewLoader: {
    marginVertical: spacing.lg,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
  },
  restoreBtnPressed: {
    opacity: 0.85,
  },
  restoreText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
