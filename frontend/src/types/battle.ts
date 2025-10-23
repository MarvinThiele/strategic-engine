import type { Unit } from './unit';

// Matches the API response from /battle/local/state
export interface BattleState {
  ts_ms: number;
  units: Record<string, Unit>;
}

export interface StartBattleRequest {
  seed: number;
}

export interface StartBattleResponse {
  battle_id: string;
}
