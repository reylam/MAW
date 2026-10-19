import { clock } from '@/lib/format';
import type { Connection } from '@/store/useMawStore';
import type { CrossingState, MawState } from '@/types/maw';

export type Freshness = 'LIVE' | 'TERLAMBAT' | 'TERPUTUS';

export type DisplayState = {
  state: MawState;
  cause: string | null;
  ageS: number | null;
  freshness: Freshness;
  lastKnown: MawState | null;
};

const LIVE_MAX_S = 5;

/*
  R4: the backend computes the state, but the phone adds one local check.
  If the WebSocket is down or the newest data is older than STALE_MAX, the
  screen is forced to CEK_MANUAL no matter what the last server state said.
*/
export function displayState(
  s: CrossingState | undefined,
  connection: Connection,
  now: number,
  clockOffsetMs: number,
  staleMaxS = 15,
): DisplayState {
  const serverNow = now + clockOffsetMs;
  const ageS = s?.received_at ? Math.max(0, (serverNow - new Date(s.received_at).getTime()) / 1000) : null;
  const staleMax = s?.stale_max_s ?? staleMaxS;
  const freshness: Freshness = ageS == null || ageS > staleMax ? 'TERPUTUS' : ageS > LIVE_MAX_S ? 'TERLAMBAT' : 'LIVE';
  const lastKnown = s ? (s.state === 'CEK_MANUAL' ? s.last_known_state : s.state) : null;

  if (connection !== 'open') {
    return { state: 'CEK_MANUAL', cause: 'Koneksi ke server terputus', ageS, freshness: 'TERPUTUS', lastKnown };
  }
  if (!s) {
    return { state: 'CEK_MANUAL', cause: 'Menunggu data dari server', ageS, freshness: 'TERPUTUS', lastKnown };
  }
  const serverSilentS = (serverNow - new Date(s.server_ts).getTime()) / 1000;
  if (serverSilentS > staleMax) {
    return { state: 'CEK_MANUAL', cause: 'Server tidak mengirim pembaruan', ageS, freshness: 'TERPUTUS', lastKnown };
  }
  if (s.state !== 'CEK_MANUAL' && (ageS == null || ageS > staleMax)) {
    const since = s.received_at ? `Data tidak diterima sejak ${clock(s.received_at, true)}` : 'Data belum diterima';
    return { state: 'CEK_MANUAL', cause: since, ageS, freshness, lastKnown };
  }
  return { state: s.state, cause: s.cause, ageS, freshness, lastKnown };
}
