import { Stack } from 'expo-router';
import { colors } from '../../../src/theme';

export default function LibraryLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="note/[...path]" options={{ headerShown: false }} />
    </Stack>
  );
}
