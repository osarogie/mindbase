import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { htmlToMarkdown, wysiwygPage } from '../utils/wysiwygClient';
import { colors } from '../theme';
import { useDebouncedEffect } from '../hooks/useDebouncedEffect';

interface Props {
  path: string;
  content: string;
  onChange: (markdown: string) => void;
  onFocusChange?: (focused: boolean) => void;
  onSelectionToolbarChange?: (visible: boolean) => void;
}

export interface WysiwygEditorHandle {
  insertBlock: (block: 'h1' | 'h2' | 'h3' | 'list' | 'ordered' | 'task' | 'quote' | 'code') => void;
  insertSlashCommand: (commandId: string) => void;
  applyInlineFormat: (format: 'bold' | 'italic') => void;
  flushPendingChanges: () => Promise<string>;
}

type BridgeMessage =
  | { type: 'ready' }
  | { type: 'change'; markdown?: string; html?: string }
  | { type: 'sync'; markdown?: string; html?: string }
  | { type: 'height'; value: number }
  | { type: 'focus' }
  | { type: 'blur' }
  | { type: 'stats'; words: number; chars: number }
  | { type: 'selectionToolbar'; visible: boolean };

const LEGACY_INSERT_BLOCKS: Record<string, string> = {
  h1: '<h1>Heading</h1><p><br/></p>',
  h2: '<h2>Heading</h2><p><br/></p>',
  list: '<ul><li>Item</li></ul><p><br/></p>',
  task: '<ul class="task-list"><li class="task-item"><input type="checkbox"/> Task</li></ul><p><br/></p>',
  quote: '<blockquote>Quote</blockquote><p><br/></p>',
  code: '<pre><code>code</code></pre><p><br/></p>',
};

const SYNC_MARKDOWN_JS = `
(function () {
  if (window.mindbaseFlushSync) {
    window.mindbaseFlushSync();
    return;
  }
  if (window.mindbaseGetMarkdown && window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'sync',
      markdown: window.mindbaseGetMarkdown()
    }));
    return;
  }
  var doc = document.getElementById('doc');
  if (!doc || !window.ReactNativeWebView) return;
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'sync', html: doc.innerHTML }));
})();
true;
`;

export const WysiwygEditor = memo(
  forwardRef<WysiwygEditorHandle, Props>(function WysiwygEditor(
    { path, content, onChange, onFocusChange, onSelectionToolbarChange },
    ref,
  ) {
    const webRef = useRef<WebView>(null);
    const [pageHtml, setPageHtml] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [pendingHtml, setPendingHtml] = useState<string | null>(null);
    const [pendingMarkdown, setPendingMarkdown] = useState<string | null>(null);
    const lastEmitted = useRef(content);
    const skipNextExternal = useRef(false);
    const pendingHtmlRef = useRef<string | null>(null);
    const syncResolverRef = useRef<((markdown: string) => void) | null>(null);

    const emitMarkdown = useCallback(
      (markdown: string) => {
        skipNextExternal.current = true;
        lastEmitted.current = markdown;
        pendingHtmlRef.current = null;
        setPendingHtml(null);
        setPendingMarkdown(null);
        onChange(markdown);
        return markdown;
      },
      [onChange],
    );

    const applyHtml = useCallback(
      async (html: string) => {
        const markdown = await htmlToMarkdown(html);
        return emitMarkdown(markdown);
      },
      [emitMarkdown],
    );

    const loadPage = useCallback(
      async (markdown: string) => {
        setLoading(true);
        try {
          const html = await wysiwygPage(path, markdown);
          setPageHtml(html);
          lastEmitted.current = markdown;
        } finally {
          setLoading(false);
        }
      },
      [path],
    );

    useEffect(() => {
      void loadPage(content);
    }, [path, loadPage]);

    useEffect(() => {
      if (skipNextExternal.current) {
        skipNextExternal.current = false;
        return;
      }
      if (content === lastEmitted.current) return;
      void loadPage(content);
    }, [content, loadPage]);

    useDebouncedEffect(() => {
      if (pendingMarkdown != null) {
        emitMarkdown(pendingMarkdown);
        return;
      }
      if (!pendingHtml) return;
      void applyHtml(pendingHtml).catch(() => {});
    }, [pendingHtml, pendingMarkdown, applyHtml, emitMarkdown], 320);

    useImperativeHandle(ref, () => ({
      insertBlock(block) {
        webRef.current?.injectJavaScript(`
          if (window.mindbaseInsertBlock) {
            window.mindbaseInsertBlock(${JSON.stringify(block)});
          } else if (window.mindbaseInsertHtml) {
            window.mindbaseInsertHtml(${JSON.stringify(LEGACY_INSERT_BLOCKS[block] ?? '')});
          }
          true;
        `);
      },
      insertSlashCommand(commandId) {
        webRef.current?.injectJavaScript(`
          if (window.mindbaseRunSlashCommand) {
            window.mindbaseRunSlashCommand(${JSON.stringify(commandId)});
          }
          true;
        `);
      },
      applyInlineFormat(format) {
        webRef.current?.injectJavaScript(`
          if (window.mindbaseExecFormat) {
            window.mindbaseExecFormat(${JSON.stringify(format)});
          }
          true;
        `);
      },
      flushPendingChanges() {
        return new Promise<string>((resolve) => {
          syncResolverRef.current = resolve;
          webRef.current?.injectJavaScript(SYNC_MARKDOWN_JS);
          setTimeout(() => {
            if (syncResolverRef.current) {
              syncResolverRef.current = null;
              if (pendingMarkdown != null) {
                resolve(emitMarkdown(pendingMarkdown));
                return;
              }
              const fallback = pendingHtmlRef.current;
              if (fallback) {
                void applyHtml(fallback).then(resolve);
              } else {
                resolve(lastEmitted.current);
              }
            }
          }, 400);
        });
      },
    }));

    const onMessage = (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data) as BridgeMessage;
        if (msg.type === 'ready') {
          return;
        }
        if (msg.type === 'focus') {
          onFocusChange?.(true);
          return;
        }
        if (msg.type === 'blur') {
          onFocusChange?.(false);
          return;
        }
        if (msg.type === 'selectionToolbar') {
          onSelectionToolbarChange?.(msg.visible);
          return;
        }
        if (msg.type === 'change') {
          if (typeof msg.markdown === 'string') {
            setPendingMarkdown(msg.markdown);
            return;
          }
          if (msg.html) {
            pendingHtmlRef.current = msg.html;
            setPendingHtml(msg.html);
          }
        }
        if (msg.type === 'sync') {
          const resolver = syncResolverRef.current;
          syncResolverRef.current = null;
          if (!resolver) return;
          if (typeof msg.markdown === 'string') {
            resolver(emitMarkdown(msg.markdown));
            return;
          }
          if (msg.html) {
            void applyHtml(msg.html).then(resolver);
          }
        }
      } catch {
        // ignore
      }
    };

    if (loading || !pageHtml) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      );
    }

    return (
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: pageHtml }}
        onMessage={onMessage}
        scrollEnabled
        hideKeyboardAccessoryView={Platform.OS === 'ios'}
        keyboardDisplayRequiresUserAction={false}
        style={styles.webview}
        containerStyle={styles.webviewContainer}
        setBuiltInZoomControls={false}
        showsVerticalScrollIndicator={false}
      />
    );
  }),
);

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.editorBg,
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: colors.editorBg,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.editorBg,
  },
});
