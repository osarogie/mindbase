import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radii } from '../theme';

export interface OverflowMenuAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface Props {
  actions: OverflowMenuAction[];
  title?: string;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export function OverflowMenuButton({ actions, title, accessibilityLabel, style }: Props) {
  const openMenu = () => {
    if (actions.length === 0) return;
    Alert.alert(
      title ?? 'More',
      undefined,
      [
        ...actions.map((action) => ({
          text: action.label,
          style: action.destructive ? ('destructive' as const) : undefined,
          onPress: action.onPress,
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  return (
    <Pressable
      onPress={openMenu}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? 'More options'}
    >
      <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
});
