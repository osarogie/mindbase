import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';

interface Props {
  onNewPage: () => void;
  onToday: () => void;
  onRefresh: () => void;
}

export function ActionChips({ onNewPage, onToday, onRefresh }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onNewPage}
        style={({ pressed }) => [styles.chip, styles.chipPrimary, pressed && styles.pressed]}
      >
        <Ionicons name="add" size={16} color={colors.primaryFg} />
        <Text style={styles.chipPrimaryText}>New page</Text>
      </Pressable>
      <Pressable
        onPress={onToday}
        style={({ pressed }) => [styles.chip, styles.chipSecondary, pressed && styles.pressed]}
      >
        <Ionicons name="today-outline" size={16} color={colors.accent} />
        <Text style={styles.chipSecondaryText}>Today</Text>
      </Pressable>
      <Pressable
        onPress={onRefresh}
        accessibilityLabel="Refresh"
        style={({ pressed }) => [styles.chip, styles.chipGhost, pressed && styles.pressed]}
      >
        <Ionicons name="refresh-outline" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill,
    minHeight: 38,
  },
  chipPrimary: {
    backgroundColor: colors.accent,
  },
  chipPrimaryText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primaryFg,
    textTransform: 'none',
    letterSpacing: 0,
  },
  chipSecondary: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipSecondaryText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.accent,
    textTransform: 'none',
    letterSpacing: 0,
  },
  chipGhost: {
    paddingHorizontal: spacing.sm + 2,
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
});
