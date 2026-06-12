import Constants from 'expo-constants';
import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const IOS_MIN_TOP = 47;
const ANDROID_MIN_TOP = 24;

export function fallbackTopInset() {
  if (Platform.OS === 'android') {
    return Math.max(StatusBar.currentHeight ?? 0, ANDROID_MIN_TOP);
  }
  return Math.max(Constants.statusBarHeight ?? 0, IOS_MIN_TOP);
}

export function useEffectiveTopInset() {
  const insets = useSafeAreaInsets();
  return insets.top > 0 ? insets.top : fallbackTopInset();
}

export function useEffectiveBottomInset() {
  const insets = useSafeAreaInsets();
  return insets.bottom;
}

export function useSafeTopPadding(extra = 0) {
  return useEffectiveTopInset() + extra;
}

export function useSafeAreaDebugMetrics() {
  const insets = useSafeAreaInsets();
  const fallbackTop = fallbackTopInset();
  const effectiveTop = insets.top > 0 ? insets.top : fallbackTop;
  return { insets, fallbackTop, effectiveTop, usesFallback: insets.top <= 0 };
}

/** Always returns the top inset to apply explicitly (never relies on automatic adjustment). */
export function useTopSpacerHeight() {
  return useEffectiveTopInset();
}
