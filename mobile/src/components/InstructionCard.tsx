import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { clock, decimal, STATE_LABEL } from '@/lib/format';
import { radius, space, statusColor, type Theme } from '@/theme/tokens';
import type { DisplayState } from '@/hooks/useDisplayState';
import type { CrossingState } from '@/types/maw';
import AckButton from './AckButton';

type Sizes = { title: number; subtitle: number; body: number };

const ICON = {
  AMAN: 'check-circle',
  SIAGA: 'alert',
  TUTUP: 'alert-octagon',
  MENUNGGU_AMAN: 'timer-sand',
  CEK_MANUAL: 'alert',
} as const;

const TITLE = {
  AMAN: 'PALANG BOLEH DIBUKA',
  SIAGA: 'BERSIAP MENUTUP',
  TUTUP: 'TUTUP PALANG SEKARANG',
  MENUNGGU_AMAN: 'TETAP TUTUP',
  CEK_MANUAL: 'CEK MANUAL',
} as const;

// Diagonal 45° stripes so CEK MANUAL differs from every other state even in grayscale.
function Stripes({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
      <View style={styles.stripeField}>
        {Array.from({ length: 70 }, (_, i) => (
          <View key={i} style={[styles.stripe, { backgroundColor: color }]} />
        ))}
      </View>
    </View>
  );
}

export default function InstructionCard({
  theme,
  sizes,
  display,
  crossing,
  holdRemainingS,
  ack,
}: {
  theme: Theme;
  sizes: Sizes;
  display: DisplayState;
  crossing: CrossingState | undefined;
  holdRemainingS: number | null;
  ack: { onPress: () => void; busy: boolean; error: string | null };
}) {
  const state = display.state;
  const fill = statusColor(theme, state);
  const on = theme.onStatus;

  // 150 ms color transition between states.
  const prevFill = useRef(fill);
  const progress = useRef(new Animated.Value(1)).current;
  const from = useRef(fill);
  if (prevFill.current !== fill) {
    from.current = prevFill.current;
    prevFill.current = fill;
    progress.setValue(0);
  }
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 150, useNativeDriver: false }).start();
  }, [fill, progress]);
  const background = progress.interpolate({ inputRange: [0, 1], outputRange: [from.current, fill] });

  // Slow 1 Hz pulse on TUTUP until the closure is confirmed.
  const acknowledged = Boolean(crossing?.acknowledged);
  const pulsing = state === 'TUTUP' && !acknowledged;
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pulsing) { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.78, duration: 500, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulsing, pulse]);

  const hold = holdRemainingS ?? crossing?.hold_buka_s ?? 20;
  const holdTotal = crossing?.hold_buka_s ?? 20;

  let subtitle: string;
  switch (state) {
    case 'AMAN': subtitle = 'Tidak ada kereta terdeteksi. Pastikan rel kosong secara visual.'; break;
    case 'SIAGA': subtitle = `Sinyal kereta mulai terbaca (skor ${decimal(crossing?.fusion_score_effective)}).`; break;
    case 'TUTUP': subtitle = `${crossing?.reason ?? 'Kereta terdeteksi mendekat'}.`; break;
    case 'MENUNGGU_AMAN': subtitle = `Kereta menjauh. Boleh dibuka dalam ${hold} dtk`; break;
    default: subtitle = 'Ikuti SOP manual, jangan andalkan layar ini.';
  }

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLabel={`${TITLE[state]}. ${subtitle}`}
      style={[styles.card, { backgroundColor: background }]}
    >
      {state === 'CEK_MANUAL' && <Stripes color={on === '#FFFFFF' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.10)'} />}
      <Animated.View style={[styles.inner, { opacity: pulse }]}>
        <MaterialCommunityIcons name={ICON[state]} size={sizes.title * 1.4} color={on} />
        <Text style={[styles.title, { color: on, fontSize: sizes.title, lineHeight: sizes.title * 1.08 }]}>{TITLE[state]}</Text>
        <Text style={[styles.subtitle, { color: on, fontSize: sizes.subtitle }]}>{subtitle}</Text>

        {state === 'MENUNGGU_AMAN' && (
          <View style={styles.countdown}>
            <View style={[styles.ring, { borderColor: on }]}>
              <Text style={[styles.ringText, { color: on }]}>{hold}</Text>
              <Text style={[styles.ringUnit, { color: on }]}>dtk</Text>
            </View>
            <View style={[styles.track, { borderColor: on }]}>
              <View style={[styles.trackFill, { backgroundColor: on, width: `${Math.min(100, (1 - hold / holdTotal) * 100)}%` }]} />
            </View>
          </View>
        )}

        {state === 'CEK_MANUAL' && (
          <View style={styles.details}>
            {display.cause && <Text style={[styles.detail, { color: on, fontSize: sizes.body }]}>Penyebab: {display.cause}</Text>}
            {crossing?.received_at && (
              <Text style={[styles.detail, { color: on, fontSize: sizes.body }]}>Data terakhir diterima {clock(crossing.received_at, true)}</Text>
            )}
            {display.lastKnown && (
              <Text style={[styles.detail, { color: on, fontSize: sizes.body }]}>Status terakhir diketahui: {STATE_LABEL[display.lastKnown]}</Text>
            )}
          </View>
        )}
      </Animated.View>

      {state === 'TUTUP' && (
        <AckButton theme={theme} acknowledged={crossing?.acknowledged ?? null} {...ack} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexGrow: 1, borderRadius: radius.card, padding: space.xl, gap: space.lg, overflow: 'hidden', justifyContent: 'center' },
  inner: { alignItems: 'center', gap: space.md },
  title: { fontWeight: '800', textAlign: 'center', letterSpacing: 0.5 },
  subtitle: { fontWeight: '500', textAlign: 'center' },
  details: { gap: space.xs, alignSelf: 'stretch' },
  detail: { fontWeight: '500', textAlign: 'center' },
  countdown: { alignItems: 'center', gap: space.md, alignSelf: 'stretch' },
  ring: { width: 96, height: 96, borderRadius: 48, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  ringText: { fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ringUnit: { fontSize: 12, fontWeight: '600', marginTop: -4 },
  track: { height: 10, alignSelf: 'stretch', borderRadius: 5, borderWidth: 1.5, overflow: 'hidden' },
  trackFill: { height: '100%' },
  clip: { overflow: 'hidden', borderRadius: radius.card },
  stripeField: { position: 'absolute', top: -600, left: -600, width: 2000, height: 2000, transform: [{ rotate: '45deg' }] },
  stripe: { height: 14, marginBottom: 14 },
});
