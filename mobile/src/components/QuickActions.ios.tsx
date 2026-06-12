import { Button, Host, HStack } from '@expo/ui/swift-ui';

interface Props {
  onNewPage: () => void;
  onToday: () => void;
  onRefresh: () => void;
}

export function QuickActions({ onNewPage, onToday, onRefresh }: Props) {
  return (
    <Host matchContents={{ horizontal: true }}>
      <HStack spacing={8}>
        <Button label="New" systemImage="plus" onPress={onNewPage} />
        <Button label="Today" systemImage="calendar" onPress={onToday} />
        <Button label="Refresh" systemImage="arrow.clockwise" onPress={onRefresh} />
      </HStack>
    </Host>
  );
}
