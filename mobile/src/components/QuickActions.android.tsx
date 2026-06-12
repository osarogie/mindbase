import { Button, Host, Row } from '@expo/ui/jetpack-compose';
import { Text } from 'react-native';

interface Props {
  onNewPage: () => void;
  onToday: () => void;
  onRefresh: () => void;
}

export function QuickActions({ onNewPage, onToday, onRefresh }: Props) {
  return (
    <Host matchContents={{ horizontal: true }}>
      <Row horizontalArrangement={{ spacedBy: 8 }}>
        <Button onClick={onNewPage}>
          <Text>New</Text>
        </Button>
        <Button onClick={onToday}>
          <Text>Today</Text>
        </Button>
        <Button onClick={onRefresh}>
          <Text>Refresh</Text>
        </Button>
      </Row>
    </Host>
  );
}
