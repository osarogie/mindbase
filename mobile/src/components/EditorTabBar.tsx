import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EditorTab } from '../context/EditorTabsContext';
import { iconForDocumentKind } from '../utils/documentIcons';
import { colors, radii, spacing, typography } from '../theme';

interface Props {
  tabs: EditorTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export function EditorTabBar({ tabs, activeId, onSelect, onClose }: Props) {
  if (tabs.length <= 1) return null;

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <Pressable
              key={tab.id}
              onPress={() => onSelect(tab.id)}
              style={({ pressed }) => [
                styles.tab,
                active && styles.tabActive,
                pressed && styles.tabPressed,
              ]}
            >
              <Ionicons
                name={iconForDocumentKind(tab.kind)}
                size={13}
                color={active ? colors.accent : colors.textMuted}
              />
              <Text style={[styles.title, active && styles.titleActive]} numberOfLines={1}>
                {tab.title}
                {tab.dirty ? ' •' : ''}
              </Text>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  onClose(tab.id);
                }}
                hitSlop={8}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel={`Close ${tab.title}`}
              >
                <Ionicons name="close" size={14} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: 168,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  tabActive: {
    borderColor: colors.accent,
    backgroundColor: colors.bg,
  },
  tabPressed: {
    opacity: 0.88,
  },
  title: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  titleActive: {
    color: colors.text,
    fontWeight: '600',
  },
  closeBtn: {
    marginLeft: 2,
  },
});
