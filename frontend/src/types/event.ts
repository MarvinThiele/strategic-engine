// Matches the API response from /battle/local/events
export interface BattleEvent {
  kind: string;
  ts_ms: number;
  data: Record<string, any>;
}

export interface EventsResponse {
  next_offset: number;
  events: BattleEvent[];
}
