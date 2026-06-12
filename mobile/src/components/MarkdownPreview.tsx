import { marked } from 'marked';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors, radii, spacing } from '../theme';

interface Props {
  content: string;
  embedded?: boolean;
}

marked.setOptions({ gfm: true, breaks: true });

function previewDocument(body: string, embedded: boolean) {
  const pad = embedded
    ? `padding: ${spacing.sm}px ${spacing.lg}px ${spacing.md}px;`
    : `padding: ${spacing.md}px ${spacing.lg}px;`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      ${pad}
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 16px;
      line-height: 1.625;
      color: ${colors.text};
      background: transparent;
      -webkit-text-size-adjust: 100%;
    }
    h1 { font-size: 26px; line-height: 1.25; margin: 8px 0 12px; font-weight: 700; }
    h2 { font-size: 20px; line-height: 1.3; margin: 16px 0 8px; font-weight: 600; }
    h3 { font-size: 17px; line-height: 1.35; margin: 12px 0 6px; font-weight: 600; }
    p, ul, ol, pre, blockquote { margin: 0 0 12px; }
    ul, ol { padding-left: 1.25rem; }
    code {
      background: ${colors.surfaceMuted};
      border-radius: 4px;
      padding: 0.1em 0.35em;
      font-family: Menlo, monospace;
      font-size: 14px;
    }
    pre {
      background: #1E1E1E;
      color: #f5f5f5;
      border-radius: ${radii.md}px;
      padding: 12px;
      overflow-x: auto;
    }
    pre code { background: transparent; padding: 0; color: inherit; }
    blockquote {
      border-left: 3px solid ${colors.borderStrong};
      padding-left: 12px;
      color: ${colors.textSecondary};
    }
    a { color: ${colors.accent}; text-decoration: none; }
    hr { border: none; border-top: 1px solid ${colors.border}; margin: 16px 0; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

const heightScript = `
  (function () {
    function sendHeight() {
      var height = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        120
      );
      window.ReactNativeWebView.postMessage(String(height));
    }
    sendHeight();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(sendHeight);
    }
    new ResizeObserver(sendHeight).observe(document.body);
  })();
  true;
`;

export function MarkdownPreview({ content, embedded = false }: Props) {
  const [height, setHeight] = useState(120);

  const html = useMemo(() => {
    const source = content.trim() || '_Start writing to see your page come to life._';
    const parsed = marked.parse(source, { async: false }) as string;
    return previewDocument(parsed, embedded);
  }, [content, embedded]);

  const onMessage = (event: WebViewMessageEvent) => {
    const next = Number.parseInt(event.nativeEvent.data, 10);
    if (Number.isFinite(next) && next > 0) {
      setHeight(next);
    }
  };

  return (
    <View style={[styles.wrap, embedded && styles.embedded, { minHeight: height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        onMessage={onMessage}
        injectedJavaScript={heightScript}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        style={[styles.webview, { height }]}
        containerStyle={styles.webviewContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  embedded: {
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  webviewContainer: {
    backgroundColor: 'transparent',
  },
  webview: {
    backgroundColor: 'transparent',
  },
});
