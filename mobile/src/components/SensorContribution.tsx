import { StyleSheet, Text, View } from 'react-native';
import { ListChecks } from 'lucide-react-native';
import { decimal } from '@/lib/format';
import { font, space, type Theme } from '@/theme/tokens';
import type { Contribution } from '@/types/maw';
import { Card, CardHeader } from './ui/Card';

const ROWS: { field: Contribution['field']; label: string }[] = [
  { field: 'v_norm', label: 'Getaran' },
  { field: 'l_norm', label: 'Beban' },
  { field: 'm_norm', label: 'Magnet' },
  { field: 's_norm', label: 'Suara' },
];

// "KENAPA?": weight × normalized value per sensor (DESIGN.md 5.3).
export default function SensorContribution({
  theme,
  contributions,
  weights,
}: {
  theme: Theme;
  contributions: Contribution[] | null;
  weights: Record<Contribution['field'], number> | undefined;
}) {
  const maxWeight = Math.max(...Object.values(weights ?? { v_norm: 0.35 }));
  return (
    <Card theme={theme}>
      <CardHeader theme={theme} eyebrow="Kenapa?" title="Kontribusi sensor" icon={ListChecks} />
      {ROWS.map(({ field, label }, i) => {
        const c = contributions?.find((x) => x.field === field);
        const weight = c?.weight ?? weights?.[field] ?? 0;
        const missing = !c || c.value == null;
        return (
          <View
            key={field}
            style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: theme.borderSubtle }]}
            accessibilityLabel={missing ? `${label} tidak terbaca` : `${label} ${decimal(c.value)} kali ${decimal(weight)} sama dengan ${decimal(c.result)}`}
          >
            <View style={styles.labelCol}>
              <Text style={[styles.label, { color: missing ? theme.textSubtle : theme.text }]}>{label}</Text>
              <Text style={[styles.formula, { color: theme.textSubtle }]}>
                {missing ? 'tidak terbaca' : `${decimal(c.value)} × ${decimal(weight)}`}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: theme.hover }]}>
              {!missing && <View style={[styles.fill, { width: `${((c.result ?? 0) / maxWeight) * 100}%`, backgroundColor: theme.primary }]} />}
            </View>
            <Text style={[styles.result, { color: missing ? theme.textSubtle : theme.text }]}>{missing ? '-' : decimal(c.result)}</Text>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  labelCol: { width: 104 },
  label: { fontFamily: font.sansMedium, fontSize: 14 },
  formula: { fontFamily: font.mono, fontSize: 11, fontVariant: ['tabular-nums'], marginTop: 1 },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  result: { width: 40, textAlign: 'right', fontFamily: font.monoBold, fontSize: 14, fontVariant: ['tabular-nums'] },
});
