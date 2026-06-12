import { Button } from '@expo/ui';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme';

interface Props {
  onNewPage: () => void;
  onToday: () => void;
  onRefresh: () => void;
}

export function QuickActions({ onNewPage, onToday, onRefresh }: Props) {
  return (
    <View style={styles.row}>
      <Button label="New" variant="filled" onPress={onNewPage} />
      <Button label="Today" variant="outlined" onPress={onToday} />
      <Button label="Refresh" variant="text" onPress={onRefresh} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
