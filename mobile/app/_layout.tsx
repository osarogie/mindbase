import { Stack, ThemeProvider } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppKeyboardProvider } from '../src/components/AppKeyboardProvider';
import { CommandPalette } from '../src/components/CommandPalette';
import { CommandPaletteFab } from '../src/components/CommandPaletteFab';
import { CommandPaletteProvider } from '../src/context/CommandPaletteContext';
import { EditorTabsProvider } from '../src/context/EditorTabsContext';
import { VaultProvider } from '../src/context/VaultContext';
import { MindbaseTheme } from '../src/navigation/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppKeyboardProvider>
        <ThemeProvider value={MindbaseTheme}>
          <VaultProvider>
            <EditorTabsProvider>
              <CommandPaletteProvider>
                <View style={styles.root}>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="editor" />
                  </Stack>
                  <CommandPalette />
                  <CommandPaletteFab />
                </View>
              </CommandPaletteProvider>
            </EditorTabsProvider>
          </VaultProvider>
        </ThemeProvider>
      </AppKeyboardProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
