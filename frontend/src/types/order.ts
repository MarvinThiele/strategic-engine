import type { Position } from './unit';

export type OrderKind = 'move' | 'attack' | 'defend';

// Matches the Order model in backend/engine/model.py
export interface Order {
  kind: OrderKind;
  unit_id: string;
  target_pos?: Position;
  target_unit_id?: string;
  client_ts_ms?: number;
}

export interface SubmitOrdersResponse {
  queued: number;
}

export interface TimeControlResponse {
  time_compression: number;
}
