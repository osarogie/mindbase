import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EditorTabBar } from '../components/EditorTabBar';
import { useEditorTabs } from '../context/EditorTabsContext';
import { useVault } from '../context/VaultContext';
import { closeEditor } from '../navigation/editorRoute';
import { DatabaseScreen } from './DatabaseScreen';
import { NoteScreen } from './NoteScreen';
import { AssetViewerScreen } from './AssetViewerScreen';
import { colors } from '../theme';

export function EditorWorkspaceScreen() {
  const router = useRouter();
  const { tabs, activeId, setActiveTab, closeTab } = useEditorTabs();
  const { items } = useVault();
  const leaveEditor = useCallback(() => closeEditor(router), [router]);

  useEffect(() => {
    if (tabs.length === 0) {
      leaveEditor();
    }
  }, [leaveEditor, tabs.length]);

  const handleCloseTab = (id: string) => {
    const tab = tabs.find((item) => item.id === id);
    if (tab?.dirty) {
      Alert.alert('Unsaved changes', `Close "${tab.title}" anyway?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: () => {
            const remaining = closeTab(id);
            if (remaining.length === 0) leaveEditor();
          },
        },
      ]);
      return;
    }
    const remaining = closeTab(id);
    if (remaining.length === 0) leaveEditor();
  };

  if (tabs.length === 0 || !activeId) {
    return null;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <EditorTabBar
        tabs={tabs}
        activeId={activeId}
        onSelect={setActiveTab}
        onClose={handleCloseTab}
      />
      <View style={styles.editors}>
        {tabs.map((tab) => (
          <View
            key={tab.id}
            style={[styles.editorPane, tab.id !== activeId && styles.editorHidden]}
            pointerEvents={tab.id === activeId ? 'auto' : 'none'}
          >
            {(() => {
              const filePath = items.find((item) => item.path === tab.path && item.kind === tab.kind)?.file_path;
              if (tab.kind === 'database') {
                return (
                  <DatabaseScreen name={tab.path} showBack onBack={leaveEditor} />
                );
              }
              if (tab.kind === 'note') {
                return (
                  <NoteScreen path={tab.path} showBack onBack={leaveEditor} />
                );
              }
              return (
                <AssetViewerScreen
                  kind={tab.kind}
                  path={tab.path}
                  title={tab.title}
                  filePath={filePath}
                  onBack={leaveEditor}
                />
              );
            })()}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  editors: {
    flex: 1,
    minHeight: 0,
  },
  editorPane: {
    ...StyleSheet.absoluteFill,
  },
  editorHidden: {
    opacity: 0,
  },
});
