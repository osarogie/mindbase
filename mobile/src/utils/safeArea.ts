import Constants from 'expo-constants';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

/** Native status bar height from Expo (reliable when safe-area context reports 0). */
export function nativeStatusBarHeight(): number {
  const fromConstants = Constants.statusBarHeight ?? 0;
  const fromAndroid = Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 0 : 0;
  return Math.max(fromConstants, fromAndroid);
}

/** Ensures non-zero top inset when the provider reports 0 (edge-to-edge / cold start). */
export function effectiveInsets(insets: EdgeInsets): EdgeInsets {
  const topFloor = nativeStatusBarHeight();
  return {
    top: Math.max(insets.top, topFloor),
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  };
}
