import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { clock, duration } from '@/lib/format';
import { radius, space, type Theme } from '@/theme/tokens';
import type { MawEvent } from '@/types/maw';

// Collapsible list of today's last 10 events (5.6).
export default function EventLog({
  theme,
  events,
  error,
  bodySize,
  defaultOpen = false,
}: {
  theme: Theme;
  events: MawEvent[];
  error: string | null;
  bodySize: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.head} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={[styles.title, { color: theme.text, fontSize: bodySize }]}>Riwayat hari ini</Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={theme.textMuted} />
      </Pressable>
      {open && (
        <View style={styles.list}>
          {error && <Text style={[styles.empty, { color: theme.textMuted }]}>Riwayat tidak dapat dimuat: {error}</Text>}
          {!error && events.length === 0 && <Text style={[styles.empty, { color: theme.textMuted }]}>Belum ada kejadian hari ini.</Text>}
          {events.map((e) => {
            const extra = e.metadata?.duration_s != null ? `(durasi ${duration(e.metadata.duration_s)})` : e.event_type === 'maw_state' ? '' : e.description;
            return (
              <View key={e.id} style={styles.row}>
                <Text style={[styles.time, { color: theme.textMuted, fontSize: bodySize - 1 }]}>{clock(e.occurred_at)}</Text>
                <Text style={[styles.text, { color: theme.text, fontSize: bodySize - 1 }]}>
                  {e.title}{extra ? `  ${extra}` : ''}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: space.lg },
  head: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: '600' },
  list: { paddingBottom: space.md, gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  time: { width: 44, fontVariant: ['tabular-nums'] },
  text: { flex: 1 },
  empty: { fontSize: 14 },
});
