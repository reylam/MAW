import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react-native';
import { clock, duration } from '@/lib/format';
import { font, space, toneColors, toneOf, type Theme, type Tone } from '@/theme/tokens';
import type { MawEvent } from '@/types/maw';
import { Card, CardHeader } from './ui/Card';

function eventTone(e: MawEvent): Tone {
  if (e.event_type === 'maw_ack') return 'safe';
  if (e.event_type === 'maw_score_mismatch') return 'warning';
  if (e.event_type === 'maw_ack_overdue') return 'critical';
  const to = e.metadata?.to;
  if (e.event_type === 'device_status') return to === 'disconnected' ? 'critical' : 'safe';
  return to && to !== 'connected' && to !== 'disconnected' ? toneOf(to) : 'offline';
}

// Collapsible list of today's last 10 events (DESIGN.md 5.6), styled like the web "Recent activity".
export default function EventLog({
  theme,
  events,
  error,
  defaultOpen = false,
}: {
  theme: Theme;
  events: MawEvent[];
  error: string | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <Card theme={theme}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <CardHeader
          theme={theme}
          eyebrow="Hari ini"
          title="Riwayat kejadian"
          icon={Clock}
          divider={open}
          action={<Chevron size={18} color={theme.textSubtle} />}
        />
      </Pressable>
      {open && (
        <View>
          {error && <Text style={[styles.empty, { color: theme.textSubtle }]}>Riwayat tidak dapat dimuat: {error}</Text>}
          {!error && events.length === 0 && <Text style={[styles.empty, { color: theme.textSubtle }]}>Belum ada kejadian hari ini.</Text>}
          {events.map((e, i) => {
            const desc = e.metadata?.duration_s != null ? `Durasi tutup ${duration(e.metadata.duration_s)}` : e.description;
            return (
              <View key={e.id} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: theme.borderSubtle }]}>
                <View style={[styles.dot, { backgroundColor: toneColors(theme, eventTone(e)).fg }]} />
                <View style={styles.text}>
                  <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{e.title}</Text>
                  {!!desc && <Text style={[styles.desc, { color: theme.textSubtle }]} numberOfLines={1}>{desc}</Text>}
                </View>
                <Text style={[styles.time, { color: theme.textSubtle }]}>{clock(e.occurred_at)}</Text>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: font.sansMedium, fontSize: 14 },
  desc: { fontFamily: font.sans, fontSize: 12, marginTop: 1 },
  time: { fontFamily: font.mono, fontSize: 11, marginTop: 2, fontVariant: ['tabular-nums'] },
  empty: { fontFamily: font.sans, fontSize: 13, padding: space.lg },
});
