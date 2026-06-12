import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { memo, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  KeyboardAvoidingView,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNativeTabBarInset } from '../hooks/useNativeTabBarInset';
import { colors, radii, spacing, typography } from '../theme';
import { HistoryPanel } from './HistoryPanel';
import { IconButton } from './IconButton';
import { SafeTopSpacer } from './SafeTopSpacer';
import { WysiwygEditor, type WysiwygEditorHandle } from './WysiwygEditor';
import type { Note } from 'mindbase';

interface Props {
  note: Note;
  content: string;
  dirty: boolean;
  saving: boolean;
  onBack?: () => void;
  includeTopInset?: boolean;
  onChange: (content: string) => void;
  onSave: (contentOverride?: string) => void | Promise<void>;
}

export interface NoteEditorHandle {
  saveWithFlush: () => Promise<void>;
}

const TOOLBAR_DOCK_HEIGHT = 52;

const TOOLBAR = [
  { icon: 'text-outline' as const, label: 'H1', action: { type: 'block' as const, block: 'h1' as const } },
  { icon: 'remove-outline' as const, label: 'H2', action: { type: 'block' as const, block: 'h2' as const } },
  { icon: 'list-outline' as const, label: 'List', action: { type: 'block' as const, block: 'list' as const } },
  { icon: 'checkbox-outline' as const, label: 'Task', action: { type: 'block' as const, block: 'task' as const } },
  { icon: 'chatbox-ellipses-outline' as const, label: 'Quote', action: { type: 'block' as const, block: 'quote' as const } },
  { icon: 'code-slash-outline' as const, label: 'Code', action: { type: 'block' as const, block: 'code' as const } },
  { glyph: 'B' as const, label: 'Bold', action: { type: 'inline' as const, format: 'bold' as const }, bold: true },
  { glyph: 'I' as const, label: 'Italic', action: { type: 'inline' as const, format: 'italic' as const }, italic: true },
];

export const NoteEditor = memo(
  forwardRef<NoteEditorHandle, Props>(function NoteEditor(
    {
      note,
      content,
      dirty,
      saving,
      onBack,
      includeTopInset = true,
      onChange,
      onSave,
    },
    ref,
  ) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const editorRef = useRef<WysiwygEditorHandle>(null);
  const insets = useSafeAreaInsets();
  const tabBarInset = useNativeTabBarInset();

  const handleSave = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const flushed = await editorRef.current?.flushPendingChanges();
    if (flushed !== undefined && flushed !== content) {
      onChange(flushed);
    }
    await onSave(flushed);
  };

  useImperativeHandle(ref, () => ({
    saveWithFlush: handleSave,
  }));

  const runToolbarAction = (action: (typeof TOOLBAR)[number]['action']) => {
    if (action.type === 'block') {
      editorRef.current?.insertBlock(action.block);
    } else {
      editorRef.current?.applyInlineFormat(action.format);
    }
    void Haptics.selectionAsync();
  };

  const toolbarBottomInset = Math.max(spacing.sm, insets.bottom);

  return (
    <View style={styles.root}>
      {includeTopInset ? <SafeTopSpacer backgroundColor={colors.editorBg} /> : null}

      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          {onBack ? <IconButton icon="chevron-back" onPress={onBack} /> : null}
          <Text style={styles.path} numberOfLines={1}>
            {note.path}
          </Text>
        </View>
        <View style={styles.topActions}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, dirty ? styles.statusDotDirty : styles.statusDotSaved]} />
            <Text style={styles.status}>{saving ? 'Saving…' : dirty ? 'Editing' : 'Saved'}</Text>
          </View>
          <Pressable
            onPress={() => setHistoryOpen(true)}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Version history"
          >
            <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!dirty || saving}
            onPress={() => void handleSave()}
            style={({ pressed }) => [
              styles.saveBtn,
              (!dirty || saving) && styles.saveBtnDisabled,
              pressed && dirty && !saving && styles.saveBtnPressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="checkmark" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.editorStack}
        behavior="padding"
        keyboardVerticalOffset={tabBarInset}
      >
        <View style={[styles.editorPane, { paddingBottom: TOOLBAR_DOCK_HEIGHT }]}>
          <WysiwygEditor ref={editorRef} path={note.path} content={content} onChange={onChange} />
        </View>
      </KeyboardAvoidingView>

      <KeyboardStickyView offset={{ closed: 0, opened: tabBarInset }}>
        <View style={[styles.toolbarDock, { paddingBottom: toolbarBottomInset }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.toolbarContent}
          >
            {TOOLBAR.map((item) => (
              <Pressable
                key={item.label}
                onPress={() => runToolbarAction(item.action)}
                style={({ pressed }) => [styles.toolChip, pressed && styles.toolChipPressed]}
              >
                {'icon' in item ? (
                  <Ionicons name={item.icon} size={14} color={colors.textSecondary} />
                ) : (
                  <Text
                    style={[
                      styles.toolGlyph,
                      item.bold && styles.toolGlyphBold,
                      item.italic && styles.toolGlyphItalic,
                    ]}
                  >
                    {item.glyph}
                  </Text>
                )}
                <Text style={styles.toolLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </KeyboardStickyView>

      <HistoryPanel
        path={note.path}
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestore={(restored) => {
          onChange(restored);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />
    </View>
  );
}),
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.editorBg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.editorBg,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    minWidth: 0,
  },
  path: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
  },
  statusDotDirty: {
    backgroundColor: colors.accent,
  },
  statusDotSaved: {
    backgroundColor: colors.success,
  },
  status: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: {
    opacity: 0.85,
  },
  saveBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: colors.borderStrong,
  },
  saveBtnPressed: {
    opacity: 0.85,
  },
  editorStack: {
    flex: 1,
    minHeight: 0,
  },
  editorPane: {
    flex: 1,
    minHeight: 0,
  },
  toolbarDock: {
    flexGrow: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.editorBg,
  },
  toolbarContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  toolChipPressed: {
    backgroundColor: colors.border,
  },
  toolLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toolGlyph: {
    fontSize: 14,
    color: colors.textSecondary,
    minWidth: 14,
    textAlign: 'center',
  },
  toolGlyphBold: {
    fontWeight: '800',
  },
  toolGlyphItalic: {
    fontStyle: 'italic',
    fontWeight: '600',
  },
});
