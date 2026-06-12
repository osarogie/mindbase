import Constants from 'expo-constants';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { Platform, StatusBar as RNStatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { effectiveInsets } from '../utils/safeArea';

interface Props {
  children: ReactNode;
  onLayoutMetrics?: (data: {
    rawTop: number;
    effectiveTop: number;
    statusBarHeight: number;
    bodyY: number;
  }) => void;
}

/** Root layout chrome — explicit status-bar spacer + safe-area padding. */
export function ScreenShell({ children, onLayoutMetrics }: Props) {
  const rawInsets = useSafeAreaInsets();
  const insets = effectiveInsets(rawInsets);
  const statusBarHeight = Constants.statusBarHeight ?? 0;

  return (
    <View style={styles.root}>
      <ExpoStatusBar style="dark" />
      {Platform.OS === 'android' ? (
        <RNStatusBar
          barStyle="dark-content"
          translucent={false}
          backgroundColor={colors.surfaceMuted}
        />
      ) : null}
      <View style={[styles.statusBarSpacer, { height: insets.top }]} />
      <View
        style={[
          styles.content,
          {
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
        onLayout={(event) => {
          onLayoutMetrics?.({
            rawTop: rawInsets.top,
            effectiveTop: insets.top,
            statusBarHeight,
            bodyY: event.nativeEvent.layout.y,
          });
        }}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  statusBarSpacer: {
    backgroundColor: colors.surfaceMuted,
  },
  content: {
    flex: 1,
  },
});
