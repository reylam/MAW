import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { font, radius, space, type Theme, type Tone } from '@/theme/tokens';
import type { DisplayState, Freshness } from '@/hooks/useDisplayState';
import type { CrossingState } from '@/types/maw';
import StatusBadge from './ui/StatusBadge';
import { Eyebrow } from './ui/Card';

const FRESH_TONE: Record<Freshness, Tone> = { LIVE: 'safe', TERLAMBAT: 'warning', TERPUTUS: 'critical' };

function ageText(ageS: number | null): string {
  if (ageS == null) return 'Belum ada data';
  const s = Math.floor(ageS);
  return s < 60 ? `Diperbarui ${s} dtk lalu` : `Diperbarui ${Math.floor(s / 60)} mnt lalu`;
}

// App bar (logo, connection, operator) + page header (crossing, data age, node). DESIGN.md 5.4.
export default function TopBar({
  theme,
  crossing,
  display,
  operatorName,
  onLogout,
}: {
  theme: Theme;
  crossing: CrossingState | undefined;
  display: DisplayState;
  operatorName: string;
  onLogout: () => void;
}) {
  const initial = (operatorName.trim()[0] ?? '?').toUpperCase();
  const confirmLogout = () =>
    Alert.alert('Keluar?', `Masuk sebagai ${operatorName}.`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: onLogout },
    ]);

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="MAW" />
        <View style={styles.right}>
          <StatusBadge theme={theme} tone={FRESH_TONE[display.freshness]} label={display.freshness} />
          <Pressable onPress={confirmLogout} hitSlop={8} accessibilityLabel={`Operator ${operatorName}, ketuk untuk keluar`}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          </Pressable>
        </View>
      </View>

      <View>
        <Eyebrow theme={theme}>
          Perlintasan{crossing?.node.node_id ? ` · ${crossing.node.node_id}` : ''}
        </Eyebrow>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {crossing?.crossing_name ?? 'Menghubungkan…'}
        </Text>
        <Text style={[styles.meta, { color: theme.textMuted }]}>{ageText(display.ageS)}</Text>
      </View>

      {crossing?.warnings.map((w) => (
        <View key={w} style={[styles.alert, { backgroundColor: theme.warningSoft, borderColor: theme.warningBorder }]}>
          <TriangleAlert size={16} color={theme.warning} />
          <Text style={[styles.alertText, { color: theme.warning }]}>{w}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 84, height: 30 },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontFamily: font.sansSemi, fontSize: 14 },
  title: { fontFamily: font.displayBold, fontSize: 22, letterSpacing: -0.2, marginTop: 2 },
  meta: { fontFamily: font.sans, fontSize: 13, marginTop: 2 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: radius.md, padding: space.md },
  alertText: { fontFamily: font.sansMedium, fontSize: 13, flex: 1 },
});
