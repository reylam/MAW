import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gauge, Info } from 'lucide-react-native';
import { decimal } from '@/lib/format';
import { font, radius, space, type Theme } from '@/theme/tokens';
import type { Sample } from '@/store/useMawStore';
import type { CrossingState } from '@/types/maw';
import { Card, CardHeader } from './ui/Card';

type Thresholds = { siaga: number; tutup: number };

function zoneColor(theme: Theme, score: number, t: Thresholds) {
  return score >= t.tutup ? theme.critical : score >= t.siaga ? theme.warning : theme.safe;
}

const pct = (v: number) => `${Math.min(100, Math.max(0, v * 100))}%` as const;

function Sparkline({ theme, samples, thresholds, now }: { theme: Theme; samples: Sample[]; thresholds: Thresholds; now: number }) {
  const H = 48;
  const windowMs = 120_000;
  const recent = samples.filter((s) => now - s.t <= windowMs);
  return (
    <View style={[styles.spark, { height: H, borderColor: theme.borderSubtle }]} accessibilityLabel="Fusion Score 2 menit terakhir">
      <View style={[styles.dashRow, { bottom: thresholds.tutup * H }]}>
        {Array.from({ length: 48 }, (_, i) => <View key={i} style={[styles.dash, { backgroundColor: theme.critical }]} />)}
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
      {recent.length === 0 && <Text style={[styles.empty, { color: theme.textSubtle }]}>Belum ada data</Text>}
    </View>
  );
}

// DESIGN.md 5.2: score, 0-1 bar with siaga/tutup markers, 2-minute sparkline.
export default function FusionScoreBar({
  theme,
  crossing,
  samples,
  now,
  scoreSize,
}: {
  theme: Theme;
  crossing: CrossingState | undefined;
  samples: Sample[];
  now: number;
  scoreSize: number;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const t = crossing?.thresholds ?? { siaga: 0.4, tutup: 0.6 };
  const score = crossing?.fusion_score ?? null;

  return (
    <Card theme={theme}>
      <CardHeader
        theme={theme}
        eyebrow="Skor gabungan"
        title="Fusion Score"
        icon={Gauge}
        action={crossing?.score_mismatch ? (
          <Pressable onPress={() => setShowInfo((v) => !v)} hitSlop={12} accessibilityLabel="Info skor tidak konsisten">
            <Info size={18} color={theme.warning} />
          </Pressable>
        ) : undefined}
      />
      <View style={styles.body}>
        <Text style={[styles.score, { color: score == null ? theme.textSubtle : zoneColor(theme, score, t), fontSize: scoreSize }]}>
          {decimal(score)}
        </Text>

        {showInfo && crossing?.score_mismatch && (
          <View style={[styles.alert, { backgroundColor: theme.warningSoft, borderColor: theme.warningBorder }]}>
            <Text style={[styles.alertText, { color: theme.warning }]}>
              Skor node {decimal(crossing.fusion_score_node)}, hitung ulang {decimal(crossing.fusion_score)}. Status memakai nilai tertinggi ({decimal(crossing.fusion_score_effective)}).
            </Text>
          </View>
        )}

        <View>
          <View style={[styles.bar, { backgroundColor: theme.hover, borderColor: theme.border }]}>
            {score != null && <View style={[styles.barFill, { width: pct(score), backgroundColor: zoneColor(theme, score, t) }]} />}
          </View>
          <View style={[styles.marker, { left: pct(t.siaga), backgroundColor: theme.textMuted }]} />
          <View style={[styles.marker, { left: pct(t.tutup), backgroundColor: theme.textMuted }]} />
        </View>
        <View style={styles.scale}>
          <Text style={[styles.tick, { color: theme.textSubtle, left: 0 }]}>0</Text>
          <Text style={[styles.tick, { color: theme.textSubtle, left: pct(t.siaga) }]}>{decimal(t.siaga)} siaga</Text>
          <Text style={[styles.tick, { color: theme.textSubtle, left: pct(t.tutup) }]}>{decimal(t.tutup)} tutup</Text>
          <Text style={[styles.tick, { color: theme.textSubtle, right: 0 }]}>1</Text>
        </View>

        <Sparkline theme={theme} samples={samples} thresholds={t} now={now} />
        <Text style={[styles.caption, { color: theme.textSubtle }]}>2 menit terakhir</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  score: { fontFamily: font.monoBold, fontVariant: ['tabular-nums'] },
  alert: { borderWidth: 1, borderRadius: radius.md, padding: space.md },
  alertText: { fontFamily: font.sans, fontSize: 13, lineHeight: 18 },
  bar: { height: 12, borderRadius: 6, borderWidth: 1, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  marker: { position: 'absolute', top: -3, bottom: -3, width: 2, marginLeft: -1, borderRadius: 1 },
  scale: { height: 14 },
  tick: { position: 'absolute', fontFamily: font.mono, fontSize: 10, fontVariant: ['tabular-nums'] },
  spark: { position: 'relative', overflow: 'hidden', borderBottomWidth: 1 },
  sparkBar: { position: 'absolute', bottom: 0, width: 3, marginLeft: -3, borderTopLeftRadius: 1, borderTopRightRadius: 1 },
  dashRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', height: 1, opacity: 0.6 },
  dash: { width: 4, height: 1 },
  empty: { fontFamily: font.mono, fontSize: 11, textAlign: 'center', marginTop: 16 },
  caption: { fontFamily: font.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'right' },
});
