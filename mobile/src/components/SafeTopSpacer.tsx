import { StyleSheet, View } from 'react-native';
import { useTopSpacerHeight } from '../hooks/useSafeTopPadding';
import { colors } from '../theme';

interface Props {
  backgroundColor?: string;
}

export function SafeTopSpacer({ backgroundColor = colors.bg }: Props) {
  const top = useTopSpacerHeight();
  if (top <= 0) return null;
  return <View style={[styles.spacer, { height: top, backgroundColor }]} />;
}

const styles = StyleSheet.create({
  spacer: {
    width: '100%',
  },
});
