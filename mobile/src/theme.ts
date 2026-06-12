import { Platform, StyleSheet, type ViewStyle } from 'react-native';

/** Paper light palette — matches web Mindbase theme */
export const colors = {
  bg: '#F6F2E8',
  editorBg: '#FCFAF3',
  surface: '#FCFAF3',
  surfaceMuted: '#EFE9DA',
  surfaceElevated: '#FFFDF7',
  border: '#DAD0B8',
  borderStrong: '#C4B89E',
  text: '#332D21',
  textSecondary: '#5C5344',
  textMuted: '#867A60',
  accent: '#6B5034',
  accentHover: '#5C4228',
  accentSoft: '#E8DFD0',
  primary: '#6B5034',
  primaryHover: '#5C4228',
  primarySoft: '#E8DFD0',
  teal: '#147A64',
  danger: '#BC4636',
  dangerSoft: '#FCEEEA',
  success: '#3E7C4F',
  primaryFg: '#FFFDF7',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  screen: 20,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const typography = {
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  headline: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 13, lineHeight: 18 },
  micro: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.4, textTransform: 'uppercase' as const },
};

export function softShadow(): ViewStyle {
  return Platform.select({
    ios: {
      shadowColor: '#4A3A16',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 2 },
    default: {},
  }) as ViewStyle;
}

export function hairlineBorder(color = colors.border): ViewStyle {
  return { borderWidth: StyleSheet.hairlineWidth, borderColor: color };
}
