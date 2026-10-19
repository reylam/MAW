import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { CircleAlert, Hourglass, OctagonAlert, ShieldCheck, TriangleAlert } from 'lucide-react-native';
import { clock, decimal, STATE_LABEL } from '@/lib/format';
import { fillColor, font, radius, space, type Theme } from '@/theme/tokens';
import type { DisplayState } from '@/hooks/useDisplayState';
import type { CrossingState } from '@/types/maw';
import AckButton from './AckButton';

type Sizes = { title: number; subtitle: number; body: number };

const ICON = {
  AMAN: ShieldCheck,
  SIAGA: TriangleAlert,
  TUTUP: OctagonAlert,
  MENUNGGU_AMAN: Hourglass,
  CEK_MANUAL: CircleAlert,
};

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

// The dominant block (DESIGN.md 5.1): full status color, verb title, short reason.
export default function InstructionCard({
  theme,
  sizes,
  display,
  crossing,
  holdRemainingS,
  closeLeftS,
  ack,
}: {
  theme: Theme;
  sizes: Sizes;
  display: DisplayState;
  crossing: CrossingState | undefined;
  holdRemainingS: number | null;
  closeLeftS: number | null;
  ack: { onPress: () => void; busy: boolean; error: string | null };
}) {
  const state = display.state;
  const fill = fillColor(theme, state);
  const on = theme.onFill;
  const Icon = ICON[state];

  // 150 ms color transition between states.
  const prevFill = useRef(fill);
  const from = useRef(fill);
  const progress = useRef(new Animated.Value(1)).current;
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
  const pulsing = state === 'TUTUP' && !crossing?.acknowledged;
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

  const details: string[] = [];
  if (state === 'CEK_MANUAL') {
    if (display.cause) details.push(`Penyebab: ${display.cause}`);
    if (crossing?.received_at) details.push(`Data terakhir ${clock(crossing.received_at, true)}`);
    if (display.lastKnown) details.push(`Status terakhir: ${STATE_LABEL[display.lastKnown]}`);
  }

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLabel={`${TITLE[state]}. ${subtitle}`}
      style={[styles.card, { backgroundColor: background }]}
    >
      {state === 'CEK_MANUAL' && <Stripes color={theme.dark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.09)'} />}

      <Text style={[styles.eyebrow, { color: on }]}>Instruksi palang</Text>

      <Animated.View style={[styles.inner, { opacity: pulse }]}>
        <View style={[styles.iconRing, { borderColor: on }]}>
          <Icon size={sizes.title * 1.05} color={on} strokeWidth={2.2} />
        </View>
        <Text style={[styles.title, { color: on, fontSize: sizes.title, lineHeight: sizes.title * 1.08 }]}>{TITLE[state]}</Text>
        <Text style={[styles.subtitle, { color: on, fontSize: sizes.subtitle }]}>{subtitle}</Text>

        {(state === 'TUTUP' || state === 'MENUNGGU_AMAN') && closeLeftS != null && (
          <View style={[styles.deadline, { borderColor: on }]}>
            <Text style={[styles.deadlineText, { color: on }]}>
              {closeLeftS > 0 ? `Konfirmasi dalam ${closeLeftS} dtk` : `Terlambat ${-closeLeftS} dtk, segera konfirmasi`}
            </Text>
          </View>
        )}

        {state === 'MENUNGGU_AMAN' && (
          <View style={styles.countdown}>
            <Text style={[styles.countText, { color: on }]}>{hold}<Text style={styles.countUnit}> dtk</Text></Text>
            <View style={[styles.track, { backgroundColor: theme.dark ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.25)' }]}>
              <View style={[styles.trackFill, { backgroundColor: on, width: `${Math.min(100, (1 - hold / holdTotal) * 100)}%` }]} />
            </View>
          </View>
        )}

        {details.length > 0 && (
          <View style={[styles.details, { borderColor: theme.dark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)' }]}>
            {details.map((d) => (
              <Text key={d} style={[styles.detail, { color: on, fontSize: sizes.body - 1 }]}>{d}</Text>
            ))}
          </View>
        )}
      </Animated.View>

      {(state === 'TUTUP' || (state === 'MENUNGGU_AMAN' && !crossing?.acknowledged)) && <AckButton theme={theme} fill={fill} acknowledged={crossing?.acknowledged ?? null} {...ack} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexGrow: 1, borderRadius: radius.card, padding: space.xl, gap: space.lg, overflow: 'hidden', justifyContent: 'center' },
  eyebrow: { fontFamily: font.mono, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', opacity: 0.85, position: 'absolute', top: space.lg, left: space.xl },
  inner: { alignItems: 'center', gap: space.md, paddingTop: space.lg },
  iconRing: { padding: 12, borderRadius: 999, borderWidth: 2 },
  title: { fontFamily: font.displayBold, textAlign: 'center', letterSpacing: -0.3 },
  subtitle: { fontFamily: font.sansMedium, textAlign: 'center' },
  countdown: { alignItems: 'center', gap: space.sm, alignSelf: 'stretch' },
  countText: { fontFamily: font.monoBold, fontSize: 40, fontVariant: ['tabular-nums'] },
  countUnit: { fontFamily: font.mono, fontSize: 16 },
  track: { height: 8, alignSelf: 'stretch', borderRadius: 4, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 4 },
  deadline: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 6 },
  deadlineText: { fontFamily: font.monoBold, fontSize: 14, fontVariant: ['tabular-nums'] },
  details: { alignSelf: 'stretch', borderTopWidth: 1, paddingTop: space.md, gap: 4 },
  detail: { fontFamily: font.sans, textAlign: 'center' },
  clip: { overflow: 'hidden', borderRadius: radius.card },
  stripeField: { position: 'absolute', top: -600, left: -600, width: 2000, height: 2000, transform: [{ rotate: '45deg' }] },
  stripe: { height: 14, marginBottom: 14 },
});
