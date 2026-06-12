import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface Props {
  icon: IconName;
  label?: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function IconButton({ icon, label, onPress, active, disabled, style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? icon}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        active && styles.active,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons
          name={icon}
          size={20}
          color={active ? colors.accent : disabled ? colors.textMuted : colors.textSecondary}
        />
      </View>
      {label ? <Text style={[styles.label, active && styles.labelActive]}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: {
    backgroundColor: colors.accentSoft,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.accent,
  },
});
