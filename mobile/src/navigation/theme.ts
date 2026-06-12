import { DefaultTheme } from 'expo-router';
import { colors } from '../theme';

export const MindbaseTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.surfaceElevated,
    text: colors.text,
    border: colors.border,
    notification: colors.danger,
  },
};
