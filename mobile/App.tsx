import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { API_URL } from '@/config/env';
import { useHealthStore } from '@/store/useHealthStore';

export default function App() {
  const { status, error, check } = useHealthStore();

  useEffect(() => {
    check();
  }, [check]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MAW Mobile</Text>
      <Text style={styles.subtitle}>Smart Rail Guard</Text>
      <Text>API: {API_URL}</Text>
      <Text>Backend: {status}{error ? ` (${error})` : ''}</Text>
      <Pressable style={styles.button} onPress={check}>
        <Text style={styles.buttonText}>Cek ulang</Text>
      </Pressable>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 12 },
  button: { marginTop: 12, backgroundColor: '#1d4ed8', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
