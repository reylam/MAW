import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setupAlarms } from '@/hooks/useAlarms';
import { useAuthStore } from '@/store/useAuthStore';
import { FONTS } from '@/theme/fonts';
import { useTheme } from '@/theme/tokens';
import LoginScreen from '@/screens/LoginScreen';
import MonitorScreen from '@/screens/MonitorScreen';

export default function App() {
  const theme = useTheme();
  const { operator, ready, restore } = useAuthStore();
  // A font load error must never block the safety screen: fall back to system fonts.
  const [fontsLoaded, fontError] = useFonts(FONTS);

  useEffect(() => {
    restore();
    setupAlarms();
  }, [restore]);

  const loading = !ready || (!fontsLoaded && !fontError);

  return (
    <SafeAreaProvider>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : operator ? (
        <MonitorScreen />
      ) : (
        <LoginScreen />
      )}
    </SafeAreaProvider>
  );
}
