import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { CROSSING_ID } from '@/config/env';
import { decimal } from '@/lib/format';
import { apiPost } from '@/services/api';
import { startMawSocket, stopMawSocket } from '@/services/mawSocket';
import { useAuthStore } from '@/store/useAuthStore';
import { useMawStore } from '@/store/useMawStore';
import { useNow } from '@/hooks/useNow';
import { displayState } from '@/hooks/useDisplayState';
import { useAlarms } from '@/hooks/useAlarms';
import { useEventLog } from '@/hooks/useEventLog';
import { space, type, useTheme } from '@/theme/tokens';
import type { CrossingState } from '@/types/maw';
import FreshnessHeader from '@/components/FreshnessHeader';
import InstructionCard from '@/components/InstructionCard';
import FusionScoreBar from '@/components/FusionScoreBar';
import SensorContribution from '@/components/SensorContribution';
import EventLog from '@/components/EventLog';

const STARTUP_GRACE_MS = 15_000; // no CEK MANUAL alarm while the first connection is made

export default function MonitorScreen() {
  useKeepAwake();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= 768 && width > height;
  const sizes = width >= 768 ? type.tablet : type.phone;

  const operator = useAuthStore((s) => s.operator);
  const logout = useAuthStore((s) => s.logout);
  const { connection, crossings, samples, clockOffsetMs } = useMawStore();
  const now = useNow(1000);
  const startedAt = useRef(Date.now()).current;

  useEffect(() => {
    startMawSocket();
    return () => stopMawSocket();
  }, []);

  const crossing: CrossingState | undefined = CROSSING_ID ? crossings[CROSSING_ID] : Object.values(crossings)[0];
  const display = displayState(crossing, connection, now, clockOffsetMs);
  const holdRemainingS = crossing?.hold_remaining_s != null
    ? Math.max(0, Math.ceil(crossing.hold_remaining_s - (now + clockOffsetMs - new Date(crossing.server_ts).getTime()) / 1000))
    : null;

  // Ack: optimistic, then confirmed by the next crossing.state from the server.
  const [ackBusy, setAckBusy] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);
  const acknowledge = async () => {
    if (!crossing || !operator) return;
    setAckBusy(true);
    setAckError(null);
    try {
      const next = await apiPost<CrossingState>(`/crossings/${encodeURIComponent(crossing.crossing_id)}/ack`, { operator });
      useMawStore.getState().upsert(next);
    } catch (e) {
      setAckError((e as Error).message);
    } finally {
      setAckBusy(false);
    }
  };

  const muted = display.state === 'CEK_MANUAL' && !crossing?.received_at && now - startedAt < STARTUP_GRACE_MS;
  useAlarms({
    state: display.state,
    acknowledged: Boolean(crossing?.acknowledged),
    crossingName: crossing?.crossing_name ?? 'Perlintasan',
    muted,
  });

  const { events, error: eventsError } = useEventLog(crossing?.crossing_id ?? null, `${crossing?.state}|${crossing?.acknowledged?.at}`);

  const w = crossing?.weights;
  const t = crossing?.thresholds;
  const rules = w && t
    ? `bobot ${[w.v_norm, w.l_norm, w.m_norm, w.s_norm].map((v) => decimal(v)).join('/')} · T ${decimal(t.siaga)}/${decimal(t.tutup)}`
    : '';

  const header = (
    <FreshnessHeader
      theme={theme}
      crossing={crossing}
      display={display}
      operatorName={operator?.name || operator?.email || ''}
      onLogout={logout}
      metaSize={sizes.meta}
      bodySize={sizes.body}
    />
  );
  const card = (
    <InstructionCard
      theme={theme}
      sizes={sizes}
      display={display}
      crossing={crossing}
      holdRemainingS={holdRemainingS}
      ack={{ onPress: acknowledge, busy: ackBusy, error: ackError }}
    />
  );
  const details = (
    <>
      <FusionScoreBar theme={theme} crossing={crossing} samples={crossing ? samples[crossing.crossing_id] ?? [] : []} now={now + clockOffsetMs} scoreSize={sizes.score} metaSize={sizes.meta} />
      <SensorContribution theme={theme} contributions={crossing?.contributions ?? null} weights={w} bodySize={sizes.body} />
      <EventLog theme={theme} events={events} error={eventsError} bodySize={sizes.body} defaultOpen={wide} />
      {rules ? <Text style={[styles.rules, { color: theme.textMuted, fontSize: sizes.meta }]}>{rules}</Text> : null}
    </>
  );

  const pad = { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl, paddingLeft: insets.left + space.lg, paddingRight: insets.right + space.lg };

  if (wide) {
    return (
      <View style={[styles.root, styles.wide, { backgroundColor: theme.bg }, pad]}>
        <View style={styles.left}>
          {header}
          <View style={styles.fill}>{card}</View>
        </View>
        <ScrollView style={styles.right} contentContainerStyle={styles.gap}>{details}</ScrollView>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.root, { backgroundColor: theme.bg }]} contentContainerStyle={[styles.gap, pad]}>
      {header}
      <View style={{ minHeight: height * 0.45 }}>{card}</View>
      {details}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  wide: { flexDirection: 'row', gap: space.xl },
  left: { flex: 6, gap: space.md },
  right: { flex: 4 },
  fill: { flex: 1 },
  gap: { gap: space.lg },
  rules: { textAlign: 'center', fontVariant: ['tabular-nums'] },
});
