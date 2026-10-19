import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowRight, CircleAlert, Mail } from 'lucide-react-native';
import { useAuthStore } from '@/store/useAuthStore';
import { font, radius, space, useTheme } from '@/theme/tokens';

// Mirrors the web "Operator sign in" page. Petugas sign in so confirmations are attributed (DESIGN.md 5.5).
export default function LoginScreen() {
  const theme = useTheme();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = busy || !email.trim();

  const submit = async () => {
    if (disabled) return;
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
      <View style={styles.column}>
        <View style={styles.brand}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="MAW" />
          <Text style={[styles.tagline, { color: theme.textSubtle }]}>Monitoring • Alert • Warning</Text>
        </View>

        {error && (
          <View accessibilityRole="alert" style={[styles.alert, { backgroundColor: theme.criticalSoft, borderColor: theme.criticalBorder }]}>
            <CircleAlert size={16} color={theme.critical} />
            <Text style={[styles.alertText, { color: theme.critical }]}>{error}</Text>
          </View>
        )}

        <Text style={[styles.title, { color: theme.text }]}>Masuk petugas</Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>Gunakan email petugas yang terdaftar untuk membuka layar pos jaga.</Text>

        <Text style={[styles.label, { color: theme.textMuted }]}>Email petugas</Text>
        <View style={[styles.inputWrap, { backgroundColor: theme.surface, borderColor: focused ? theme.primary : theme.border }]}>
          <Mail size={16} color={theme.textSubtle} />
          <TextInput
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="petugas@maw.id"
            placeholderTextColor={theme.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="go"
            onSubmitEditing={submit}
            style={[styles.input, { color: theme.text }]}
          />
        </View>

        <Pressable
          onPress={submit}
          disabled={disabled}
          style={({ pressed }) => [styles.button, { backgroundColor: theme.primary, opacity: disabled ? 0.6 : pressed ? 0.9 : 1 }]}
        >
          {busy ? (
            <>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.buttonText}>Memeriksa…</Text>
            </>
          ) : (
            <>
              <Text style={styles.buttonText}>Lanjut</Text>
              <ArrowRight size={16} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: space.xxl },
  column: { width: '100%', maxWidth: 384, alignSelf: 'center' },
  brand: { alignItems: 'center', marginBottom: 32, gap: space.md },
  logo: { width: 120, height: 40 },
  tagline: { fontFamily: font.mono, fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase' },
  alert: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderRadius: radius.md, padding: space.md, marginBottom: space.xl },
  alertText: { flex: 1, fontFamily: font.sans, fontSize: 14 },
  title: { fontFamily: font.display, fontSize: 20, marginBottom: 4 },
  sub: { fontFamily: font.sans, fontSize: 14, marginBottom: space.xxl },
  label: { fontFamily: font.sansSemi, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 48 },
  input: { flex: 1, fontFamily: font.sans, fontSize: 15, paddingVertical: 10 },
  button: { marginTop: space.xl, minHeight: 48, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  buttonText: { color: '#FFFFFF', fontFamily: font.sansSemi, fontSize: 15 },
});
