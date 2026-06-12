import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCommandPalette } from '../context/CommandPaletteContext';
import { filterPaletteCommands, usePaletteCommands, type PaletteCommand } from '../hooks/usePaletteCommands';
import { useEffectiveBottomInset, useSafeTopPadding } from '../hooks/useSafeTopPadding';
import { colors, radii, spacing, typography } from '../theme';

export function CommandPalette() {
  const { open, closePalette } = useCommandPalette();
  const commands = usePaletteCommands();
  const bottomInset = useEffectiveBottomInset();
  const topPadding = useSafeTopPadding(spacing.md);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<TextInput>(null);

  const filtered = useMemo(() => filterPaletteCommands(commands, query), [commands, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setIndex(0);
      return;
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  const run = useCallback(
    (cmd: PaletteCommand) => {
      void Promise.resolve(cmd.run());
    },
    [],
  );

  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={closePalette}>
      <Pressable style={[styles.backdrop, { paddingTop: topPadding }]} onPress={closePalette}>
        <Pressable style={[styles.panel, { marginBottom: Math.max(spacing.lg, bottomInset) }]} onPress={() => {}}>
          <View style={styles.inputRow}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder="Type a command or search…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={() => {
                const cmd = filtered[index];
                if (cmd) run(cmd);
              }}
            />
            {Platform.OS === 'web' ? (
              <Text style={styles.shortcut}>⌘K</Text>
            ) : (
              <Pressable onPress={closePalette} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>No matching commands</Text>
            }
            renderItem={({ item, index: rowIndex }) => (
              <Pressable
                onPress={() => run(item)}
                style={({ pressed }) => [
                  styles.row,
                  rowIndex === index && styles.rowActive,
                  pressed && styles.rowPressed,
                ]}
              >
                <Ionicons name={item.icon} size={16} color={colors.textSecondary} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  {item.hint ? (
                    <Text style={styles.rowHint} numberOfLines={1}>
                      {item.hint}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(51, 45, 33, 0.45)',
    paddingHorizontal: spacing.lg,
    justifyContent: 'flex-start',
  },
  panel: {
    maxHeight: '72%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    fontSize: 16,
    color: colors.text,
    paddingVertical: spacing.xs,
  },
  shortcut: {
    ...typography.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  list: {
    maxHeight: 360,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowActive: {
    backgroundColor: colors.accentSoft,
  },
  rowPressed: {
    opacity: 0.88,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    ...typography.body,
    fontSize: 15,
    color: colors.text,
  },
  rowHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  empty: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.xl,
  },
});
