import { Stack } from 'expo-router';
import { colors } from '../../../src/theme';

export default function JournalLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
