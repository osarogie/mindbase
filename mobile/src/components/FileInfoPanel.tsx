import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, spacing, typography } from '../theme';
import type { FileInfoDetails } from '../utils/fileInfo';
import { useEffectiveBottomInset } from '../hooks/useSafeTopPadding';
import { SafeTopSpacer } from './SafeTopSpacer';

interface Props {
  details: FileInfoDetails | null;
  visible: boolean;
  onClose: () => void;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

export function FileInfoPanel({ details, visible, onClose }: Props) {
  const bottomInset = useEffectiveBottomInset();

  if (!details) return null;

  const kindLabel = details.kind === 'database' ? 'Database' : 'Page';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <SafeTopSpacer backgroundColor={colors.surfaceElevated} />
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>File info</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {details.title}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + bottomInset }]}
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={styles.card}>
            <InfoRow label="Type" value={kindLabel} />
            <InfoRow label="Filename" value={details.filename} />
            <InfoRow label="Vault path" value={details.vaultPath} />
            <InfoRow label="Folder" value={details.folder} />
            <InfoRow label="Location" value={details.location} />
            {details.modified ? <InfoRow label="Modified" value={details.modified} /> : null}
          </View>
          <Text style={styles.hint}>Paths are selectable — tap and hold to copy.</Text>
        </ScrollView>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.headline,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  content: {
    padding: spacing.screen,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    ...typography.micro,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  rowValue: {
    ...typography.body,
    color: colors.text,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
