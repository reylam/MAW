import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { decimal } from '@/lib/format';
import { radius, space, type Theme } from '@/theme/tokens';
import type { Sample } from '@/store/useMawStore';
import type { CrossingState } from '@/types/maw';

function zoneColor(theme: Theme, score: number, t: { siaga: number; tutup: number }) {
  return score >= t.tutup ? theme.zoneDanger : score >= t.siaga ? theme.zoneStandby : theme.zoneSafe;
}

function Sparkline({ theme, samples, thresholds, now }: { theme: Theme; samples: Sample[]; thresholds: { siaga: number; tutup: number }; now: number }) {
  const H = 44;
  const windowMs = 120_000;
  const recent = samples.filter((s) => now - s.t <= windowMs);
  return (
    <View style={[styles.spark, { height: H }]} accessibilityLabel="Fusion Score 2 menit terakhir">
      {/* dashed line at T_TUTUP */}
      <View style={[styles.dashRow, { bottom: thresholds.tutup * H }]}>
        {Array.from({ length: 40 }, (_, i) => <View key={i} style={[styles.dash, { backgroundColor: theme.zoneDanger }]} />)}
      </View>
      {recent.map((s) => (
        <View
          key={s.t}
          style={[styles.sparkBar, {
            left: `${Math.max(0, 100 - ((now - s.t) / windowMs) * 100)}%`,
            height: Math.max(2, s.score * H),
            backgroundColor: zoneColor(theme, s.score, thresholds),
          }]}
        />
      ))}
    </View>
  );
}

export default function FusionScoreBar({
  theme,
  crossing,
  samples,
  now,
  scoreSize,
  metaSize,
}: {
  theme: Theme;
  crossing: CrossingState | undefined;
  samples: Sample[];
  now: number;
  scoreSize: number;
  metaSize: number;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const t = crossing?.thresholds ?? { siaga: 0.4, tutup: 0.6 };
  const score = crossing?.fusion_score ?? null;
  const pct = (v: number) => `${Math.min(100, Math.max(0, v * 100))}%` as const;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.headRow}>
        <Text style={[styles.eyebrow, { color: theme.textMuted }]}>FUSION SCORE</Text>
        <View style={styles.scoreRow}>
          {crossing?.score_mismatch && (
            <Pressable onPress={() => setShowInfo((v) => !v)} hitSlop={12} accessibilityLabel="Info skor tidak konsisten">
              <MaterialCommunityIcons name="information-outline" size={22} color={theme.zoneStandby} />
            </Pressable>
          )}
          <Text style={[styles.score, { color: theme.text, fontSize: scoreSize }]}>{decimal(score)}</Text>
        </View>
      </View>
      {showInfo && crossing?.score_mismatch && (
        <Text style={[styles.info, { color: theme.textMuted, fontSize: metaSize + 1 }]}>
          Skor node {decimal(crossing.fusion_score_node)}, hitung ulang {decimal(crossing.fusion_score)}. Status memakai nilai tertinggi ({decimal(crossing.fusion_score_effective)}).
        </Text>
      )}

      <View style={[styles.bar, { backgroundColor: theme.border }]}>
        {score != null && <View style={[styles.barFill, { width: pct(score), backgroundColor: zoneColor(theme, score, t) }]} />}
        <View style={[styles.marker, { left: pct(t.siaga), backgroundColor: theme.text }]} />
        <View style={[styles.marker, { left: pct(t.tutup), backgroundColor: theme.text }]} />
      </View>
      <View style={styles.scale}>
        <Text style={[styles.tick, { color: theme.textMuted, fontSize: metaSize, left: 0 }]}>0</Text>
        <Text style={[styles.tick, { color: theme.textMuted, fontSize: metaSize, left: pct(t.siaga) }]}>{decimal(t.siaga)} siaga</Text>
        <Text style={[styles.tick, { color: theme.textMuted, fontSize: metaSize, left: pct(t.tutup) }]}>{decimal(t.tutup)} tutup</Text>
        <Text style={[styles.tick, { color: theme.textMuted, fontSize: metaSize, right: 0 }]}>1</Text>
      </View>

      <Sparkline theme={theme} samples={samples} thresholds={t} now={now} />
      <Text style={[styles.caption, { color: theme.textMuted, fontSize: metaSize }]}>2 menit terakhir</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, padding: space.lg, gap: space.sm },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  score: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  info: { lineHeight: 18 },
  bar: { height: 14, borderRadius: 7, overflow: 'hidden', marginTop: space.xs },
  barFill: { height: '100%', borderRadius: 7 },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1 },
  scale: { height: 16 },
  tick: { position: 'absolute', fontVariant: ['tabular-nums'] },
  spark: { marginTop: space.sm, position: 'relative', overflow: 'hidden' },
  sparkBar: { position: 'absolute', bottom: 0, width: 3, marginLeft: -3, borderTopLeftRadius: 1, borderTopRightRadius: 1 },
  dashRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', height: 1 },
  dash: { width: 4, height: 1 },
  caption: { textAlign: 'right' },
});
