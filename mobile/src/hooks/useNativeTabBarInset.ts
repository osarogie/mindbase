import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Approximate native tab bar height above the home indicator. */
const NATIVE_TAB_BAR = Platform.select({ ios: 49, android: 56, default: 49 }) ?? 49;

export function useNativeTabBarInset(): number {
  const insets = useSafeAreaInsets();
  return NATIVE_TAB_BAR + insets.bottom;
}
