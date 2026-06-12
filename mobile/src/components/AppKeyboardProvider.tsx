import { type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

interface Props {
  children: ReactNode;
}

/** Root keyboard + gesture wiring for native tabs and editor toolbars. */
export function AppKeyboardProvider({ children }: Props) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
        {children}
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
