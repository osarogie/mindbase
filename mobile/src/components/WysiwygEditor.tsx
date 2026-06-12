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
}

export interface WysiwygEditorHandle {
  insertBlock: (block: 'h1' | 'h2' | 'list' | 'task' | 'quote' | 'code') => void;
  applyInlineFormat: (format: 'bold' | 'italic') => void;
  flushPendingChanges: () => Promise<string>;
}

type BridgeMessage =
  | { type: 'ready' }
  | { type: 'change'; html: string }
  | { type: 'sync'; html: string }
  | { type: 'height'; value: number };

const INSERT_BLOCKS: Record<string, string> = {
  h1: '<h1>Heading</h1><p><br/></p>',
  h2: '<h2>Heading</h2><p><br/></p>',
  list: '<ul><li>Item</li></ul><p><br/></p>',
  task: '<ul class="task-list"><li class="task-item"><input type="checkbox"/> Task</li></ul><p><br/></p>',
  quote: '<blockquote>Quote</blockquote><p><br/></p>',
  code: '<pre><code>code</code></pre><p><br/></p>',
};

const SYNC_HTML_JS = `
(function () {
  var doc = document.getElementById('doc');
  if (!doc || !window.ReactNativeWebView) return;
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'sync', html: doc.innerHTML }));
})();
true;
`;

export const WysiwygEditor = memo(
  forwardRef<WysiwygEditorHandle, Props>(function WysiwygEditor({ path, content, onChange }, ref) {
    const webRef = useRef<WebView>(null);
    const [pageHtml, setPageHtml] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [pendingHtml, setPendingHtml] = useState<string | null>(null);
    const lastEmitted = useRef(content);
    const skipNextExternal = useRef(false);
    const pendingHtmlRef = useRef<string | null>(null);
    const syncResolverRef = useRef<((html: string) => void) | null>(null);

    const applyMarkdown = useCallback(
      async (html: string) => {
        const markdown = await htmlToMarkdown(html);
        skipNextExternal.current = true;
        lastEmitted.current = markdown;
        pendingHtmlRef.current = null;
        setPendingHtml(null);
        onChange(markdown);
        return markdown;
      },
      [onChange],
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
      if (!pendingHtml) return;
      void applyMarkdown(pendingHtml).catch(() => {});
    }, [pendingHtml, applyMarkdown], 320);

    useImperativeHandle(ref, () => ({
      insertBlock(block) {
        const html = INSERT_BLOCKS[block];
        if (!html) return;
        webRef.current?.injectJavaScript(`window.mindbaseInsertHtml(${JSON.stringify(html)}); true;`);
      },
      applyInlineFormat(format) {
        const cmd = format === 'bold' ? 'bold' : 'italic';
        webRef.current?.injectJavaScript(`window.mindbaseExecFormat(${JSON.stringify(cmd)}); true;`);
      },
      flushPendingChanges() {
        return new Promise<string>((resolve) => {
          syncResolverRef.current = resolve;
          webRef.current?.injectJavaScript(SYNC_HTML_JS);
          setTimeout(() => {
            if (syncResolverRef.current) {
              const fallback = pendingHtmlRef.current;
              syncResolverRef.current = null;
              if (fallback) {
                void applyMarkdown(fallback).then(resolve);
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
        if (msg.type === 'change') {
          pendingHtmlRef.current = msg.html;
          setPendingHtml(msg.html);
        }
        if (msg.type === 'sync') {
          const resolver = syncResolverRef.current;
          syncResolverRef.current = null;
          if (resolver) {
            void applyMarkdown(msg.html).then(resolver);
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
