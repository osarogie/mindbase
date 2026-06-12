import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';
import { colors } from '../../src/theme';

export default function TabLayout() {
  return (
    <NativeTabs
      tintColor={colors.accent}
      minimizeBehavior="onScrollDown"
      tabBarRespectsIMEInsets
      {...(Platform.OS === 'ios' ? { backgroundColor: colors.bg } : {})}
    >
      <NativeTabs.Trigger name="(library)">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'books.vertical', selected: 'books.vertical.fill' }}
          md="library_books"
        />
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(journal)">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'book', selected: 'book.fill' }}
          md="auto_stories"
        />
        <NativeTabs.Trigger.Label>Journal</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(search)" role="search">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
