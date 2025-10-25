/**
 * Adapter to convert engine GameEvent to component BattleEvent
 */

import type { GameEvent } from '../engine/model';
import type { BattleEvent } from '../types';

export function convertGameEventToBattleEvent(event: GameEvent): BattleEvent {
  return {
    kind: event.kind,
    ts_ms: event.tsMs,
    data: event.data,
  };
}

export function convertGameEventsToBattleEvents(events: GameEvent[]): BattleEvent[] {
  return events.map(convertGameEventToBattleEvent);
}
