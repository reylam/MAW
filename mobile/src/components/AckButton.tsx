import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { clock } from '@/lib/format';
import { font, radius, space, type Theme } from '@/theme/tokens';
import type { Acknowledgement } from '@/types/maw';

// Only rendered in TUTUP. There is deliberately no "open the barrier" button (DESIGN.md 5.5).
export default function AckButton({
  theme,
  fill,
  acknowledged,
  onPress,
  busy,
  error,
}: {
  theme: Theme;
  fill: string;
  acknowledged: Acknowledgement | null;
  onPress: () => void;
  busy: boolean;
  error: string | null;
}) {
  const on = theme.onFill;

  if (acknowledged) {
    return (
      <View style={[styles.button, styles.done, { borderColor: on }]}>
        <Check size={20} color={on} />
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
        style={({ pressed }) => [styles.button, { backgroundColor: on, opacity: pressed || busy ? 0.85 : 1 }]}
      >
        {busy ? (
          <ActivityIndicator color={fill} />
        ) : (
          <>
            <Check size={22} color={fill} strokeWidth={2.6} />
            <Text style={[styles.label, { color: fill }]}>Palang sudah ditutup</Text>
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
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  done: { borderWidth: 1.5 },
  label: { fontFamily: font.sansSemi, fontSize: 16 },
  error: { fontFamily: font.sans, fontSize: 13, textAlign: 'center' },
});
