import { StyleSheet, Text, View } from 'react-native';
import { decimal } from '@/lib/format';
import { radius, space, type Theme } from '@/theme/tokens';
import type { Contribution } from '@/types/maw';

const ROWS: { field: Contribution['field']; label: string }[] = [
  { field: 'v_norm', label: 'Getaran' },
  { field: 'l_norm', label: 'Beban' },
  { field: 'm_norm', label: 'Magnet' },
  { field: 's_norm', label: 'Suara' },
];

// "KENAPA?": weight × normalized value per sensor (5.3).
export default function SensorContribution({
  theme,
  contributions,
  weights,
  bodySize,
}: {
  theme: Theme;
  contributions: Contribution[] | null;
  weights: Record<Contribution['field'], number> | undefined;
  bodySize: number;
}) {
  const maxWeight = Math.max(...Object.values(weights ?? { v: 0.35 }));
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.eyebrow, { color: theme.textMuted }]}>KENAPA?</Text>
      {ROWS.map(({ field, label }) => {
        const c = contributions?.find((x) => x.field === field);
        const weight = c?.weight ?? weights?.[field] ?? 0;
        const missing = !c || c.value == null;
        return (
          <View key={field} style={styles.row} accessibilityLabel={missing ? `${label} tidak terbaca` : `${label} ${decimal(c.value)} kali ${decimal(weight)} sama dengan ${decimal(c.result)}`}>
            <Text style={[styles.label, { color: missing ? theme.textMuted : theme.text, fontSize: bodySize }]}>{label}</Text>
            {missing ? (
              <Text style={[styles.formula, { color: theme.textMuted, fontSize: bodySize }]}>tidak terbaca</Text>
            ) : (
              <Text style={[styles.formula, { color: theme.text, fontSize: bodySize }]}>
                {decimal(c.value)} × {decimal(weight)} = {decimal(c.result)}
              </Text>
            )}
            <View style={[styles.track, { backgroundColor: theme.border }]}>
              {!missing && <View style={[styles.fill, { width: `${((c.result ?? 0) / maxWeight) * 100}%`, backgroundColor: theme.text }]} />}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, padding: space.lg, gap: space.md },
  eyebrow: { fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  label: { width: 64, fontWeight: '500' },
  formula: { flex: 1, fontVariant: ['tabular-nums'], fontWeight: '500' },
  track: { width: 72, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
