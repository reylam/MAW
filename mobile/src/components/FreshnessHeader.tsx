import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { space, type Theme } from '@/theme/tokens';
import type { DisplayState, Freshness } from '@/hooks/useDisplayState';
import type { CrossingState } from '@/types/maw';

function ageText(ageS: number | null): string {
  if (ageS == null) return 'Belum ada data';
  const s = Math.floor(ageS);
  return s < 60 ? `Diperbarui ${s} dtk lalu` : `Diperbarui ${Math.floor(s / 60)} mnt lalu`;
}

// Header: crossing, connection freshness, data age and sending node (5.4).
export default function FreshnessHeader({
  theme,
  crossing,
  display,
  operatorName,
  onLogout,
  metaSize,
  bodySize,
}: {
  theme: Theme;
  crossing: CrossingState | undefined;
  display: DisplayState;
  operatorName: string;
  onLogout: () => void;
  metaSize: number;
  bodySize: number;
}) {
  const color: Record<Freshness, string> = { LIVE: theme.zoneSafe, TERLAMBAT: theme.zoneStandby, TERPUTUS: theme.zoneDanger };
  const dot = color[display.freshness];
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[styles.name, { color: theme.text, fontSize: bodySize + 2 }]} numberOfLines={1}>
          {crossing?.crossing_name ?? 'Menghubungkan…'}
        </Text>
        <View style={styles.badge} accessibilityLabel={`Koneksi ${display.freshness}`}>
          <View style={[styles.dot, { backgroundColor: dot }]} />
          <Text style={[styles.badgeText, { color: dot, fontSize: metaSize + 1 }]}>{display.freshness}</Text>
        </View>
      </View>
      <View style={styles.row}>
        <Text style={[styles.meta, { color: theme.textMuted, fontSize: metaSize + 1 }]} numberOfLines={1}>
          {ageText(display.ageS)}{crossing?.node.node_id ? ` · ${crossing.node.node_id}` : ''}
        </Text>
        <Pressable onPress={onLogout} hitSlop={12} style={styles.user} accessibilityLabel="Keluar">
          <Text style={[styles.meta, { color: theme.textMuted, fontSize: metaSize }]} numberOfLines={1}>{operatorName}</Text>
          <MaterialCommunityIcons name="logout" size={14} color={theme.textMuted} />
        </Pressable>
      </View>
      {crossing?.warnings.map((w) => (
        <View key={w} style={styles.warn}>
          <MaterialCommunityIcons name="alert" size={14} color={theme.zoneStandby} />
          <Text style={[styles.meta, { color: theme.zoneStandby, fontSize: metaSize + 1 }]}>{w}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  name: { flex: 1, fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  badgeText: { fontWeight: '800', letterSpacing: 0.5 },
  meta: { fontWeight: '400' },
  user: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '45%' },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
