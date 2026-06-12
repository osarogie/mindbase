import { Stack } from 'expo-router';
import { colors } from '../../../src/theme';

export default function SearchLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="note/[...path]" options={{ headerShown: false }} />
    </Stack>
  );
}
