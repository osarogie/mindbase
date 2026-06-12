import Constants from 'expo-constants';
import { useMemo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useVault } from '../context/VaultContext';
import { colors, hairlineBorder, radii, softShadow, spacing, typography } from '../theme';

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function SettingsRow({
  label,
  value,
  selectable,
  onPress,
  trailing,
  last,
}: {
  label: string;
  value?: string;
  selectable?: boolean;
  onPress?: () => void;
  trailing?: ReactNode;
  last?: boolean;
}) {
  const content = (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValueWrap}>
        {value ? (
          <Text
            style={[styles.rowValue, selectable && styles.rowValueSelectable]}
            selectable={selectable}
            numberOfLines={2}
          >
            {value}
          </Text>
        ) : null}
        {trailing}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.rowPressed}>
        {content}
      </Pressable>
    );
  }

  return content;
}

export function SettingsScreen() {
  const { vaultName, vaultPath, items, refreshing, refresh } = useVault();

  const { pageCount, databaseCount } = useMemo(() => {
    let pages = 0;
    let databases = 0;
    for (const item of items) {
      if (item.kind === 'database') databases += 1;
      else pages += 1;
    }
    return { pageCount: pages, databaseCount: databases };
  }, [items]);

  const appVersion = Constants.expoConfig?.version ?? '0.1.0';
  const buildVersion =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode?.toString();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <SettingsSection title="Vault">
        <SettingsRow label="Name" value={vaultName || 'Mindbase'} />
        <SettingsRow label="Location" value={vaultPath} selectable />
        <SettingsRow label="Pages" value={String(pageCount)} />
        <SettingsRow label="Databases" value={String(databaseCount)} last />
      </SettingsSection>

      <SettingsSection title="Library">
        <Pressable
          onPress={() => void refresh()}
          disabled={refreshing}
          style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
        >
          <Text style={styles.actionLabel}>Refresh library</Text>
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={styles.actionHint}>Reload pages and databases</Text>
          )}
        </Pressable>
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsRow label="App" value="Mindbase" />
        <SettingsRow
          label="Version"
          value={buildVersion ? `${appVersion} (${buildVersion})` : appVersion}
          last
        />
      </SettingsSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.micro,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...hairlineBorder(colors.border),
    ...softShadow(),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    opacity: 0.72,
  },
  rowLabel: {
    ...typography.body,
    color: colors.text,
    flexShrink: 0,
  },
  rowValueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  rowValue: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'right',
    flexShrink: 1,
  },
  rowValueSelectable: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  actionLabel: {
    ...typography.headline,
    color: colors.accent,
  },
  actionHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
