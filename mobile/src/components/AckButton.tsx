import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { clock } from '@/lib/format';
import { radius, space, type Theme } from '@/theme/tokens';
import type { Acknowledgement } from '@/types/maw';

// Only rendered in TUTUP. There is deliberately no "open the barrier" button (5.5).
export default function AckButton({
  theme,
  acknowledged,
  onPress,
  busy,
  error,
}: {
  theme: Theme;
  acknowledged: Acknowledgement | null;
  onPress: () => void;
  busy: boolean;
  error: string | null;
}) {
  const on = theme.onStatus;

  if (acknowledged) {
    return (
      <View style={[styles.button, styles.done, { borderColor: on }]}>
        <MaterialCommunityIcons name="check" size={22} color={on} />
        <Text style={[styles.label, { color: on }]}>
          Dikonfirmasi {clock(acknowledged.at, true)} oleh {acknowledged.by}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Palang sudah ditutup"
        onPress={onPress}
        disabled={busy}
        style={({ pressed }) => [styles.button, { backgroundColor: on, opacity: pressed || busy ? 0.8 : 1 }]}
      >
        {busy ? (
          <ActivityIndicator color={theme.danger} />
        ) : (
          <>
            <MaterialCommunityIcons name="check" size={24} color={theme.danger} />
            <Text style={[styles.label, { color: theme.danger }]}>Palang sudah ditutup</Text>
          </>
        )}
      </Pressable>
      {error && <Text style={[styles.error, { color: on }]}>Gagal mengirim konfirmasi: {error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  done: { borderWidth: 2 },
  label: { fontSize: 17, fontWeight: '700' },
  error: { fontSize: 13, textAlign: 'center' },
});
