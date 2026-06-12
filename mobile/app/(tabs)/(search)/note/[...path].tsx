import { useLocalSearchParams } from 'expo-router';
import { NoteScreen } from '../../../../src/screens/NoteScreen';
import { segmentsToNotePath } from '../../../../src/navigation/notePath';

export default function SearchNoteScreen() {
  const { path } = useLocalSearchParams<{ path: string | string[] }>();
  const notePath = segmentsToNotePath(path);

  if (!notePath) return null;

  return <NoteScreen path={notePath} />;
}
