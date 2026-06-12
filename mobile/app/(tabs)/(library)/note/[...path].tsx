import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useEditorTabs } from '../../../../src/context/EditorTabsContext';
import { segmentsToNotePath } from '../../../../src/navigation/notePath';

/** Deep links to /note/... open the multi-tab editor workspace. */
export default function NoteDeepLinkScreen() {
  const { path } = useLocalSearchParams<{ path: string | string[] }>();
  const notePath = segmentsToNotePath(path);
  const { openTab } = useEditorTabs();

  useEffect(() => {
    if (notePath) openTab('note', notePath);
  }, [notePath, openTab]);

  if (!notePath) return null;

  return <Redirect href="/editor" />;
}
