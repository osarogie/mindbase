import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { aiChat } from 'mindbase';
import type { AIChatResponse } from 'mindbase';
import { colors, radii, spacing, typography } from '../theme';
import { useEffectiveBottomInset } from '../hooks/useSafeTopPadding';
import { SafeTopSpacer } from './SafeTopSpacer';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

interface Props {
  notePath: string;
  visible: boolean;
  onClose: () => void;
}

export function AIAssistantPanel({ notePath, visible, onClose }: Props) {
  const bottomInset = useEffectiveBottomInset();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const listRef = useRef<FlatList<Message>>(null);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setLoading(true);
    try {
      const res: AIChatResponse = await aiChat({
        message: text,
        note_path: notePath,
        use_vault: true,
      });
      setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }]);
      const parts: string[] = [];
      if (res.headroom_used) parts.push('Headroom');
      if (res.rtk_used) parts.push('RTK');
      if (res.tokens_saved) parts.push(`${res.tokens_saved} tokens saved`);
      if (res.model) parts.push(res.model);
      setMeta(parts.join(' · '));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((prev) => [...prev, { role: 'assistant', text: `Error: ${msg}` }]);
      setMeta('');
    } finally {
      setLoading(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [input, loading, notePath]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <SafeTopSpacer backgroundColor={colors.surfaceElevated} />
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>AI assistant</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              Vault-aware · {notePath || 'no note open'}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="sparkles-outline" size={28} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Ask about your vault</Text>
              <Text style={styles.emptyBody}>
                Summarize notes, draft content, or find connections across your local knowledge base.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
              <Text style={[styles.bubbleText, item.role === 'user' && styles.userBubbleText]}>{item.text}</Text>
            </View>
          )}
        />

        {meta ? <Text style={styles.meta}>{meta}</Text> : null}

        <View style={[styles.composer, { paddingBottom: Math.max(spacing.md, bottomInset) }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask mindbase…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            maxLength={4000}
            editable={!loading}
            onSubmitEditing={() => void send()}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={() => void send()}
            disabled={!input.trim() || loading}
            style={({ pressed }) => [
              styles.sendBtn,
              (!input.trim() || loading) && styles.sendBtnDisabled,
              pressed && input.trim() && !loading && styles.sendBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="arrow-up" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    ...typography.headline,
    fontSize: 17,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messages: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.headline,
    color: colors.text,
  },
  emptyBody: {
    ...typography.body,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  bubble: {
    maxWidth: '92%',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  bubbleText: {
    ...typography.body,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  userBubbleText: {
    color: '#fff',
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    fontSize: 15,
    color: colors.text,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.borderStrong,
  },
  sendBtnPressed: {
    opacity: 0.85,
  },
});
