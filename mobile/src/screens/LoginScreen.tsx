import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuthStore } from '@/store/useAuthStore';
import { radius, space, useTheme } from '@/theme/tokens';

// Petugas sign in with their registered email, so confirmations are attributed (5.5).
export default function LoginScreen() {
  const theme = useTheme();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await login(email);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: theme.bg }]}>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.logoWrap}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="MAW" />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>MAW Petugas</Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>Masuk dengan email petugas yang terdaftar.</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="nama@maw.id"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="go"
          onSubmitEditing={submit}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
        />
        {error && <Text style={[styles.error, { color: theme.zoneDanger }]}>{error}</Text>}
        <Pressable
          onPress={submit}
          disabled={busy || !email.trim()}
          style={({ pressed }) => [styles.button, { backgroundColor: theme.text, opacity: pressed || busy || !email.trim() ? 0.6 : 1 }]}
        >
          {busy ? <ActivityIndicator color={theme.bg} /> : <Text style={[styles.buttonText, { color: theme.bg }]}>Masuk</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: space.lg },
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: radius.card, borderWidth: 1, padding: space.xl, gap: space.md },
  // The logo artwork is on white, so it sits on a white plate in both themes.
  logoWrap: { backgroundColor: '#FFFFFF', borderRadius: radius.button, paddingVertical: space.md, alignItems: 'center' },
  logo: { width: 180, height: 70 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 15, textAlign: 'center' },
  input: { minHeight: 52, borderRadius: radius.button, borderWidth: 1, paddingHorizontal: space.lg, fontSize: 16 },
  error: { fontSize: 14 },
  button: { minHeight: 52, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
