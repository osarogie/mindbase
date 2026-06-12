import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radii, spacing } from '../theme';
import { extractTitle, insertMarkdown, setTitleInContent } from '../utils/noteContent';
import { IconButton } from './IconButton';
import { MarkdownPreview } from './MarkdownPreview';
import type { Note } from 'mindbase';

interface Props {
  note: Note;
  content: string;
  dirty: boolean;
  saving: boolean;
  onBack?: () => void;
  onChange: (content: string) => void;
  onSave: () => void;
}

const TOOLBAR = [
  { icon: 'text-outline' as const, label: 'H1', snippet: '# Heading' },
  { icon: 'remove-outline' as const, label: 'H2', snippet: '## Heading' },
  { icon: 'list-outline' as const, label: 'List', snippet: '- Item' },
  { icon: 'checkbox-outline' as const, label: 'Task', snippet: '- [ ] Task' },
  { icon: 'code-slash-outline' as const, label: 'Code', snippet: '```\ncode\n```' },
  { icon: 'link-outline' as const, label: 'Link', snippet: '[label](url)' },
];

export function NoteEditor({ note, content, dirty, saving, onBack, onChange, onSave }: Props) {
  const [focusPreview, setFocusPreview] = useState(false);
  const title = useMemo(() => extractTitle(content, note.title), [content, note.title]);

  const updateTitle = (nextTitle: string) => {
    onChange(setTitleInContent(content, nextTitle));
  };

  const appendSnippet = (snippet: string) => {
    onChange(insertMarkdown(content, snippet));
    void Haptics.selectionAsync();
  };

  const handleSave = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSave();
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          {onBack ? <IconButton icon="chevron-back" onPress={onBack} /> : null}
          <View style={styles.meta}>
            <Text style={styles.path} numberOfLines={1}>
              {note.path}
            </Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, dirty ? styles.statusDotDirty : styles.statusDotSaved]} />
              <Text style={styles.status}>
                {saving ? 'Saving…' : dirty ? 'Editing' : 'Up to date'}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.topActions}>
          <Pressable
            onPress={() => setFocusPreview((value) => !value)}
            style={({ pressed }) => [styles.modeBtn, focusPreview && styles.modeBtnActive, pressed && styles.modeBtnPressed]}
          >
            <Ionicons
              name={focusPreview ? 'eye-outline' : 'create-outline'}
              size={15}
              color={focusPreview ? colors.accent : colors.textSecondary}
            />
            <Text style={[styles.modeText, focusPreview && styles.modeTextActive]}>
              {focusPreview ? 'Preview' : 'Write'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!dirty || saving}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveBtn,
              (!dirty || saving) && styles.saveBtnDisabled,
              pressed && dirty && !saving && styles.saveBtnPressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.saveText}>Save</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageCard}>
          <TextInput
            value={title}
            onChangeText={updateTitle}
            placeholder="Untitled"
            placeholderTextColor={colors.textMuted}
            style={styles.titleInput}
          />

          {!focusPreview ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbar}>
                {TOOLBAR.map((item) => (
                  <Pressable
                    key={item.label}
                    onPress={() => appendSnippet(item.snippet)}
                    style={({ pressed }) => [styles.toolChip, pressed && styles.toolChipPressed]}
                  >
                    <Ionicons name={item.icon} size={14} color={colors.textSecondary} />
                    <Text style={styles.toolLabel}>{item.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <TextInput
                value={content}
                onChangeText={onChange}
                multiline
                textAlignVertical="top"
                placeholder="Write in markdown. Headings, lists, and links render below as you type."
                placeholderTextColor={colors.textMuted}
                style={styles.editorInput}
                autoCorrect
                spellCheck
              />
            </>
          ) : null}

          <View style={styles.previewDivider} />
          <MarkdownPreview content={content} embedded />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    minWidth: 0,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  path: {
    fontSize: 12,
    color: colors.textMuted,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
  },
  statusDotDirty: {
    backgroundColor: colors.accent,
  },
  statusDotSaved: {
    backgroundColor: colors.success,
  },
  status: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modeBtnActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoft,
  },
  modeBtnPressed: {
    opacity: 0.85,
  },
  modeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeTextActive: {
    color: colors.accent,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    minWidth: 84,
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: colors.borderStrong,
  },
  saveBtnPressed: {
    opacity: 0.85,
  },
  saveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  pageCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  titleInput: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    color: colors.text,
    padding: 0,
  },
  toolbar: {
    flexGrow: 0,
    marginHorizontal: -spacing.xs,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.xs,
  },
  toolChipPressed: {
    backgroundColor: colors.border,
  },
  toolLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  editorInput: {
    minHeight: 180,
    fontSize: 16,
    lineHeight: 26,
    color: colors.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    padding: 0,
  },
  previewDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
});
