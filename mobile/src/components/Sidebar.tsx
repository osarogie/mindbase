import { Ionicons } from '@expo/vector-icons';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radii, spacing } from '../theme';
import { formatModified } from '../utils/noteContent';
import { IconButton } from './IconButton';
import type { VaultItem } from 'mindbase';

interface Props {
  vaultName: string;
  items: VaultItem[];
  selectedPath: string | null;
  query: string;
  refreshing: boolean;
  showFab?: boolean;
  onQueryChange: (value: string) => void;
  onSelect: (item: VaultItem) => void;
  onNewPage: () => void;
  onToday: () => void;
  onRefresh: () => void;
}

export function Sidebar({
  vaultName,
  items,
  selectedPath,
  query,
  refreshing,
  showFab,
  onQueryChange,
  onSelect,
  onNewPage,
  onToday,
  onRefresh,
}: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Ionicons name="library-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.vaultName}>{vaultName || 'Mindbase'}</Text>
            <Text style={styles.meta}>{items.length} pages</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <IconButton icon="add" label="New page" onPress={onNewPage} active />
          <IconButton icon="today-outline" label="Today" onPress={onToday} />
          <IconButton icon="refresh-outline" onPress={onRefresh} />
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search pages"
            placeholderTextColor={colors.textMuted}
            style={styles.search}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          items.length === 0 && styles.listContentEmpty,
          { paddingBottom: spacing.xl * 2 + (showFab ? 72 : 0) },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No pages yet</Text>
            <Text style={styles.empty}>Create your first page or open Today&apos;s journal.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const active = item.path === selectedPath;
          return (
            <Pressable
              onPress={() => onSelect(item)}
              style={({ pressed }) => [
                styles.row,
                active && styles.rowActive,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={[styles.iconBadge, active && styles.iconBadgeActive]}>
                <Ionicons
                  name={item.kind === 'database' ? 'grid-outline' : 'document-text-outline'}
                  size={15}
                  color={active ? colors.accent : colors.textSecondary}
                />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, active && styles.rowTitleActive]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {item.folder || item.subtitle || formatModified(item.modified)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      {showFab ? (
        <Pressable
          onPress={onNewPage}
          style={({ pressed }) => [
            styles.fab,
            { bottom: spacing.lg },
            pressed && styles.fabPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="New page"
        >
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    flex: 1,
  },
  vaultName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  search: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: spacing.sm,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  rowActive: {
    backgroundColor: colors.surface,
  },
  rowPressed: {
    backgroundColor: colors.border,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  iconBadgeActive: {
    backgroundColor: colors.accentSoft,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  rowTitleActive: {
    color: colors.accent,
  },
  rowSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyWrap: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
