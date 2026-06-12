import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTopSpacerHeight, useEffectiveBottomInset } from '../hooks/useSafeTopPadding';
import { colors, radii, softShadow, spacing, typography } from '../theme';
import { formatModified } from '../utils/noteContent';
import { ActionChips } from './ActionChips';
import { ErrorBanner } from './ErrorBanner';
import type { VaultItem } from 'mindbase';
import { memo, useCallback } from 'react';

interface Props {
  vaultName: string;
  items: VaultItem[];
  selectedPath: string | null;
  query: string;
  refreshing: boolean;
  error?: string | null;
  onDismissError?: () => void;
  loading?: boolean;
  showSearch?: boolean;
  searchAutoFocus?: boolean;
  onQueryChange: (value: string) => void;
  onSelect: (item: VaultItem) => void;
  onNewPage: () => void;
  onToday: () => void;
  onRefresh: () => void;
}

const VaultRow = memo(function VaultRow({
  item,
  active,
  onSelect,
}: {
  item: VaultItem;
  active: boolean;
  onSelect: (item: VaultItem) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(item)}
      style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && styles.rowPressed]}
    >
      {active ? <View style={styles.rowAccent} /> : null}
      <View style={[styles.iconBadge, active && styles.iconBadgeActive]}>
        <Ionicons
          name={item.kind === 'database' ? 'grid-outline' : 'document-text-outline'}
          size={16}
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
      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
    </Pressable>
  );
});

export function Sidebar({
  vaultName,
  items,
  selectedPath,
  query,
  refreshing,
  error,
  onDismissError,
  loading = false,
  showSearch = true,
  searchAutoFocus = false,
  onQueryChange,
  onSelect,
  onNewPage,
  onToday,
  onRefresh,
}: Props) {
  const topInset = useTopSpacerHeight();
  const bottomInset = useEffectiveBottomInset();

  const renderItem = useCallback(
    ({ item }: { item: VaultItem }) => (
      <VaultRow item={item} active={item.path === selectedPath} onSelect={onSelect} />
    ),
    [onSelect, selectedPath],
  );

  const listHeader = (
    <View>
      <View style={[styles.topInsetSpacer, { height: topInset }]} />
      {error ? <ErrorBanner message={error} onDismiss={onDismissError ?? (() => {})} /> : null}

      <View style={styles.headerCard}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Ionicons name="library-outline" size={20} color={colors.accent} />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.vaultLabel}>Vault</Text>
            <Text style={styles.vaultName} numberOfLines={1}>
              {vaultName || 'Mindbase'}
            </Text>
            <Text style={styles.meta}>{items.length} pages</Text>
          </View>
        </View>

        <ActionChips onNewPage={onNewPage} onToday={onToday} onRefresh={onRefresh} />

        {showSearch ? (
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={17} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={onQueryChange}
              placeholder="Search pages"
              placeholderTextColor={colors.textMuted}
              style={styles.search}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={searchAutoFocus}
              clearButtonMode="while-editing"
            />
          </View>
        ) : null}
      </View>

      <View style={styles.listSectionHeader}>
        <Text style={styles.listSectionTitle}>Pages</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.root} collapsable={false}>
      <FlatList
        style={styles.list}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        initialNumToRender={14}
        maxToRenderPerBatch={12}
        windowSize={8}
        removeClippedSubviews={Platform.OS === 'android'}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustsScrollIndicatorInsets
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.listContent,
          items.length === 0 && styles.listContentEmpty,
          { paddingBottom: spacing.xxl * 2 + bottomInset },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="document-text-outline" size={24} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>No pages yet</Text>
            <Text style={styles.empty}>Create your first page or open Today&apos;s journal.</Text>
          </View>
        }
      />
      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topInsetSpacer: {
    width: '100%',
    backgroundColor: colors.bg,
  },
  headerCard: {
    marginHorizontal: spacing.screen,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...softShadow(),
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    flex: 1,
    gap: 2,
  },
  vaultLabel: {
    ...typography.micro,
    color: colors.textMuted,
  },
  vaultName: {
    ...typography.title,
    fontSize: 20,
    color: colors.text,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    minHeight: 44,
  },
  search: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 0,
  },
  listSectionHeader: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  listSectionTitle: {
    ...typography.micro,
    color: colors.textMuted,
  },
  listContent: {
    paddingHorizontal: spacing.screen,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  rowActive: {
    borderColor: colors.accentSoft,
    backgroundColor: colors.surface,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowAccent: {
    position: 'absolute',
    left: 0,
    top: spacing.sm,
    bottom: spacing.sm,
    width: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  iconBadgeActive: {
    backgroundColor: colors.accentSoft,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...typography.headline,
    fontSize: 15,
    color: colors.text,
  },
  rowTitleActive: {
    color: colors.accent,
  },
  rowSub: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyWrap: {
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
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
    maxWidth: 260,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(246, 242, 232, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
