import { NoteScreen } from '../../../../src/screens/NoteScreen';
import { segmentsToNotePath } from '../../../../src/navigation/notePath';
import { useLocalSearchParams } from 'expo-router';

export default function LibraryNoteScreen() {
  const { path } = useLocalSearchParams<{ path: string | string[] }>();
  const notePath = segmentsToNotePath(path);

  if (!notePath) return null;

  return <NoteScreen path={notePath} />;
}
