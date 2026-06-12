import { Stack } from 'expo-router';
import { colors } from '../../../src/theme';

export default function InboxLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Inbox', headerLargeTitle: true }} />
    </Stack>
  );
}
