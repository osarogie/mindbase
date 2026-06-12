import * as Haptics from 'expo-haptics';
import { usePathname } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCommandPalette } from '../context/CommandPaletteContext';
import { useNativeTabBarInset } from '../hooks/useNativeTabBarInset';
import { useEffectiveBottomInset } from '../hooks/useSafeTopPadding';
import { colors, softShadow, spacing } from '../theme';

const FAB_SIZE = 52;
const EDITOR_TOOLBAR_OFFSET = 52;

export function CommandPaletteFab() {
  const { open, openPalette } = useCommandPalette();
  const pathname = usePathname();
  const tabBarInset = useNativeTabBarInset();
  const bottomInset = useEffectiveBottomInset();
  const onEditor = pathname === '/editor' || pathname.startsWith('/editor/');
  const bottom = onEditor
    ? bottomInset + EDITOR_TOOLBAR_OFFSET + spacing.lg
    : tabBarInset + spacing.lg;

  if (open) return null;

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    openPalette();
  };

  return (
    <View pointerEvents="box-none" style={[styles.anchor, { bottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Command palette"
        accessibilityHint="Search commands and open notes"
        onPress={handlePress}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Text style={styles.glyph} accessibilityElementsHidden importantForAccessibility="no">
          ⌘
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 100,
    elevation: 100,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    ...softShadow(),
  },
  fabPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.96 }],
  },
  glyph: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.primaryFg,
    marginTop: -1,
  },
});
