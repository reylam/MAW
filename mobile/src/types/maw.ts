// Contract of the `crossing.state` WebSocket event (DESIGN.md 8.6).

export type MawState = 'AMAN' | 'SIAGA' | 'TUTUP' | 'MENUNGGU_AMAN' | 'CEK_MANUAL';

export type Contribution = {
  sensor: string;
  field: 'v_norm' | 'l_norm' | 'm_norm' | 's_norm';
  value: number | null;
  weight: number;
  result: number | null;
};

export type Acknowledgement = {
  by: string;
  email: string;
  at: string;
  score: number | null;
  took_s?: number | null;
};

export type CrossingState = {
  crossing_id: string;
  crossing_name: string;
  state: MawState;
  reason: string | null;
  cause: string | null;
  last_known_state: MawState | null;
  fusion_score: number | null;
  fusion_score_node: number | null;
  fusion_score_effective: number | null;
  score_mismatch: boolean;
  thresholds: { siaga: number; tutup: number };
  weights: Record<Contribution['field'], number>;
  hold_buka_s: number;
  stale_max_s: number;
  contributions: Contribution[] | null;
  node: { node_id: string; status: string | null; posisi: string | null };
  nodes: { node_id: string; state: MawState }[];
  warnings: string[];
  hold_remaining_s: number | null;
  received_at: string | null;
  server_ts: string;
  acknowledged: Acknowledgement | null;
  entered_at: string;
  barrier_status: 'open' | 'closed';
  close_deadline_s: number;
  close_deadline_at: string | null;
  ack_overdue: boolean;
};

export type MawEvent = {
  id: string;
  event_type: 'maw_state' | 'maw_ack' | 'maw_ack_overdue' | 'maw_score_mismatch' | 'device_status';
  title: string;
  description: string;
  occurred_at: string;
  metadata?: { from?: MawState | 'connected' | 'disconnected' | null; to?: MawState | 'connected' | 'disconnected'; duration_s?: number | null; cause?: string | null };
};

export type Operator = { id: string; email: string; name: string; role: string };
