import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme';

interface Props {
  message: string;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: Props) {
  return (
    <View style={styles.root}>
      <Ionicons name="alert-circle" size={18} color={colors.danger} />
      <Text style={styles.text} numberOfLines={2}>
        {message}
      </Text>
      <Pressable onPress={onDismiss} hitSlop={8} style={styles.dismiss}>
        <Ionicons name="close" size={18} color={colors.danger} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.danger,
  },
  text: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
    fontWeight: '500',
  },
  dismiss: {
    padding: spacing.xs,
    borderRadius: radii.sm,
  },
});
