import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { getCsvTable, readFilePayload, type CSVTable } from 'mindbase';
import type { EditorDocumentKind } from '../context/editorTabId';
import { useEditorTabs } from '../context/EditorTabsContext';
import { editorTabId } from '../context/editorTabId';
import { useVault } from '../context/VaultContext';
import { IconButton } from '../components/IconButton';
import { OverflowMenuButton } from '../components/OverflowMenuButton';
import { SafeTopSpacer } from '../components/SafeTopSpacer';
import { colors, radii, spacing, typography } from '../theme';
import { toFileUri } from '../utils/fileUri';
import { epubViewerHtml, pdfViewerHtml } from '../utils/mediaViewerHtml';

interface Props {
  kind: Extract<EditorDocumentKind, 'image' | 'pdf' | 'epub' | 'csv'>;
  path: string;
  title: string;
  filePath?: string;
  onBack?: () => void;
  onDelete?: () => void;
}

function ViewerTopBar({ title, onBack, onDelete }: { title: string; onBack?: () => void; onDelete?: () => void }) {
  return (
    <View style={styles.topBar}>
      {onBack ? <IconButton icon="chevron-back" onPress={onBack} /> : null}
      <Text style={styles.topTitle} numberOfLines={1}>
        {title}
      </Text>
      {onDelete ? (
        <OverflowMenuButton
          actions={[{ label: 'Delete', onPress: onDelete, destructive: true }]}
          accessibilityLabel="File options"
        />
      ) : null}
    </View>
  );
}

function ImageViewer({ path, filePath, title, onBack, onDelete }: Props) {
  const uri = toFileUri(filePath || path);
  return (
    <View style={styles.root}>
      <SafeTopSpacer backgroundColor={colors.editorBg} />
      <ViewerTopBar title={title} onBack={onBack} onDelete={onDelete} />
      <ScrollView contentContainerStyle={styles.imageScroll}>
        <Image source={{ uri }} style={styles.image} resizeMode="contain" accessibilityLabel={title} />
      </ScrollView>
    </View>
  );
}

function WebDocViewer({
  path,
  title,
  onBack,
  onDelete,
  buildHtml,
}: {
  path: string;
  title: string;
  onBack?: () => void;
  onDelete?: () => void;
  buildHtml: (base64: string) => string;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const payload = await readFilePayload(path);
        if (cancelled) return;
        setHtml(buildHtml(payload.base64));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildHtml, path]);

  return (
    <View style={styles.root}>
      <SafeTopSpacer backgroundColor={colors.editorBg} />
      <ViewerTopBar title={title} onBack={onBack} onDelete={onDelete} />
      {error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : !html ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          style={styles.webview}
          allowsInlineMediaPlayback
          setSupportMultipleWindows={false}
          javaScriptEnabled
          domStorageEnabled
        />
      )}
    </View>
  );
}

function PdfViewer(props: Props) {
  const { path, filePath, title, onBack, onDelete } = props;
  if (Platform.OS === 'ios' && filePath) {
    return (
      <View style={styles.root}>
        <SafeTopSpacer backgroundColor={colors.editorBg} />
        <ViewerTopBar title={title} onBack={onBack} onDelete={onDelete} />
        <WebView source={{ uri: toFileUri(filePath) }} style={styles.webview} />
      </View>
    );
  }
  return (
    <WebDocViewer
      path={path}
      title={title}
      onBack={onBack}
      onDelete={onDelete}
      buildHtml={pdfViewerHtml}
    />
  );
}

function EpubViewer(props: Props) {
  return (
    <WebDocViewer
      path={props.path}
      title={props.title}
      onBack={props.onBack}
      onDelete={props.onDelete}
      buildHtml={(base64) => epubViewerHtml(base64, props.title)}
    />
  );
}

function CsvViewer({ path, title, onBack, onDelete }: Props) {
  const [table, setTable] = useState<CSVTable | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTable(await getCsvTable(path));
    } catch (e) {
      setTable(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = table?.headers ?? [];
  const rows = table?.rows ?? [];

  return (
    <View style={styles.root}>
      <SafeTopSpacer backgroundColor={colors.editorBg} />
      <ViewerTopBar title={title} onBack={onBack} onDelete={onDelete} />
      {error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : !table ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView horizontal contentContainerStyle={styles.tableWrap}>
          <View>
            <View style={styles.tableRow}>
              {columns.map((header) => (
                <Text key={`h-${header}`} style={[styles.cell, styles.headerCell]}>
                  {header}
                </Text>
              ))}
            </View>
            {rows.map((row, rowIndex) => (
              <View key={`r-${rowIndex}`} style={styles.tableRow}>
                {columns.map((_, colIndex) => (
                  <Text key={`c-${rowIndex}-${colIndex}`} style={styles.cell}>
                    {row[colIndex] ?? ''}
                  </Text>
                ))}
              </View>
            ))}
            {rows.length === 0 ? (
              <Text style={styles.emptyCsv}>No rows in this CSV.</Text>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

export function AssetViewerScreen(props: Props) {
  const router = useRouter();
  const { deleteVaultItem } = useVault();
  const { closeTab } = useEditorTabs();

  const handleDelete = () => {
    Alert.alert('Delete file', `Delete "${props.title}" permanently?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteVaultItem(props.kind, props.path);
            closeTab(editorTabId(props.kind, props.path));
            if (props.onBack) props.onBack();
            else router.back();
          })();
        },
      },
    ]);
  };

  const viewProps = { ...props, onDelete: handleDelete };

  switch (props.kind) {
    case 'image':
      return <ImageViewer {...viewProps} />;
    case 'pdf':
      return <PdfViewer {...viewProps} />;
    case 'epub':
      return <EpubViewer {...viewProps} />;
    case 'csv':
      return <CsvViewer {...viewProps} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.editorBg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  topTitle: {
    ...typography.headline,
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  error: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: colors.editorBg,
  },
  imageScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  image: {
    width: '100%',
    minHeight: 240,
    flex: 1,
  },
  tableWrap: {
    padding: spacing.lg,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cell: {
    minWidth: 120,
    maxWidth: 220,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    fontSize: 13,
    color: colors.text,
  },
  headerCell: {
    fontWeight: '700',
    backgroundColor: colors.surfaceMuted,
    borderTopLeftRadius: radii.sm,
    borderTopRightRadius: radii.sm,
  },
  emptyCsv: {
    ...typography.caption,
    color: colors.textMuted,
    padding: spacing.lg,
  },
});
