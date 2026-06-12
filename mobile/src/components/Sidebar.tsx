import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useState, memo, useCallback } from 'react';
import { useTopSpacerHeight, useEffectiveBottomInset } from '../hooks/useSafeTopPadding';
import { colors, radii, softShadow, spacing, typography } from '../theme';
import { formatModified } from '../utils/noteContent';
import { iconForDocumentKind } from '../utils/documentIcons';
import { fileInfoFromVaultItem } from '../utils/fileInfo';
import { ActionChips } from './ActionChips';
import { ErrorBanner } from './ErrorBanner';
import { FileInfoPanel } from './FileInfoPanel';
import { OverflowMenuButton } from './OverflowMenuButton';
import { useVault } from '../context/VaultContext';
import type { VaultItem } from 'mindbase';

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
  useNativeHeader?: boolean;
  listVariant?: 'library' | 'search';
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
  onShowInfo,
}: {
  item: VaultItem;
  active: boolean;
  onSelect: (item: VaultItem) => void;
  onShowInfo: (item: VaultItem) => void;
}) {
  const openContextMenu = () => {
    Alert.alert(item.title, undefined, [
      { text: 'Open', onPress: () => onSelect(item) },
      { text: 'File info', onPress: () => onShowInfo(item) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const rowMenuActions = [{ label: 'File info', onPress: () => onShowInfo(item) }];

  return (
    <Pressable
      onPress={() => onSelect(item)}
      onLongPress={openContextMenu}
      delayLongPress={320}
      style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && styles.rowPressed]}
    >
      {active ? <View style={styles.rowAccent} /> : null}
      <View style={[styles.iconBadge, active && styles.iconBadgeActive]}>
        <Ionicons
          name={iconForDocumentKind(item.kind)}
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
      <OverflowMenuButton
        title={item.title}
        actions={rowMenuActions}
        accessibilityLabel={`More options for ${item.title}`}
      />
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
  useNativeHeader = false,
  listVariant = 'library',
  onQueryChange,
  onSelect,
  onNewPage,
  onToday,
  onRefresh,
}: Props) {
  const topInset = useTopSpacerHeight();
  const bottomInset = useEffectiveBottomInset();
  const { vaultPath } = useVault();
  const [fileInfoItem, setFileInfoItem] = useState<VaultItem | null>(null);

  const showFileInfo = useCallback((item: VaultItem) => {
    setFileInfoItem(item);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: VaultItem }) => (
      <VaultRow
        item={item}
        active={item.path === selectedPath}
        onSelect={onSelect}
        onShowInfo={showFileInfo}
      />
    ),
    [onSelect, selectedPath, showFileInfo],
  );

  const isSearchList = listVariant === 'search';
  const trimmedQuery = query.trim();

  const listHeader = (
    <View>
      {!useNativeHeader ? <View style={[styles.topInsetSpacer, { height: topInset }]} /> : null}
      {error ? <ErrorBanner message={error} onDismiss={onDismissError ?? (() => {})} /> : null}

      {!isSearchList ? (
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
      ) : null}

      {isSearchList && trimmedQuery ? (
        <View style={styles.listSectionHeader}>
          <Text style={styles.listSectionTitle}>
            {items.length === 1 ? '1 result' : `${items.length} results`}
          </Text>
        </View>
      ) : !isSearchList ? (
        <View style={styles.listSectionHeader}>
          <Text style={styles.listSectionTitle}>Pages</Text>
        </View>
      ) : null}
    </View>
  );

  const emptyComponent = isSearchList ? (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Ionicons
          name={trimmedQuery ? 'search-outline' : 'sparkles-outline'}
          size={24}
          color={colors.accent}
        />
      </View>
      <Text style={styles.emptyTitle}>{trimmedQuery ? 'No results' : 'Search your vault'}</Text>
      <Text style={styles.empty}>
        {trimmedQuery
          ? `Nothing matched "${trimmedQuery}". Try different keywords.`
          : 'Find notes, pages, and files across your vault.'}
      </Text>
    </View>
  ) : (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Ionicons name="document-text-outline" size={24} color={colors.accent} />
      </View>
      <Text style={styles.emptyTitle}>No pages yet</Text>
      <Text style={styles.empty}>Create your first page or open today&apos;s note.</Text>
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
        contentInsetAdjustmentBehavior={useNativeHeader ? 'automatic' : 'never'}
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
        ListEmptyComponent={emptyComponent}
      />
      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : null}
      <FileInfoPanel
        visible={fileInfoItem != null}
        details={fileInfoItem ? fileInfoFromVaultItem(fileInfoItem, vaultPath) : null}
        onClose={() => setFileInfoItem(null)}
      />
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
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
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
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  listSectionTitle: {
    ...typography.micro,
    color: colors.textMuted,
  },
  listContent: {
    paddingHorizontal: spacing.screen,
  },
  listContentEmpty: {
    // flexGrow: 1,
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
