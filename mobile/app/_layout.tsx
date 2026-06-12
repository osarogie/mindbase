import { Stack, ThemeProvider } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppKeyboardProvider } from '../src/components/AppKeyboardProvider';
import { VaultProvider } from '../src/context/VaultContext';
import { MindbaseTheme } from '../src/navigation/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppKeyboardProvider>
        <ThemeProvider value={MindbaseTheme}>
          <VaultProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          </VaultProvider>
        </ThemeProvider>
      </AppKeyboardProvider>
    </SafeAreaProvider>
  );
}
