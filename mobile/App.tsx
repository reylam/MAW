import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setupAlarms } from '@/hooks/useAlarms';
import { useAuthStore } from '@/store/useAuthStore';
import { useTheme } from '@/theme/tokens';
import LoginScreen from '@/screens/LoginScreen';
import MonitorScreen from '@/screens/MonitorScreen';

export default function App() {
  const theme = useTheme();
  const { operator, ready, restore } = useAuthStore();

  useEffect(() => {
    restore();
    setupAlarms();
  }, [restore]);

  return (
    <SafeAreaProvider>
      <StatusBar style={theme.bg === '#0E1116' ? 'light' : 'dark'} />
      {!ready ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
          <ActivityIndicator color={theme.text} />
        </View>
      ) : operator ? (
        <MonitorScreen />
      ) : (
        <LoginScreen />
      )}
    </SafeAreaProvider>
  );
}
