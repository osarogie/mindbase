import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { VaultApp } from './src/components/VaultApp';

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <VaultApp />
    </SafeAreaProvider>
  );
}
