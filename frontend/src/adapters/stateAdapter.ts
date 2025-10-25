/**
 * Adapter to convert between engine GameState and component BattleState
 * Converts Map<string, Unit> to Record<string, Unit> for easier component usage
 */

import type { GameState } from '../engine/model';
import type { BattleState, Unit, UnitTypeId } from '../types';

export function convertGameStateToBattleState(gameState: GameState | null): BattleState | null {
  if (!gameState) {
    return null;
  }

  // Convert Map to Record
  const units: Record<string, Unit> = {};
  for (const [id, unit] of gameState.units) {
    units[id] = {
      id: unit.id,
      side: unit.side,
      unit_type_id: unit.unitTypeId as UnitTypeId,
      pos: [unit.pos[0], unit.pos[1]], // Convert readonly tuple to mutable tuple
      hp: unit.hp,
      ammo: unit.ammo,
      routed: unit.routed,
      intent_target_pos: unit.intentTargetPos ? [unit.intentTargetPos[0], unit.intentTargetPos[1]] : null,
      target_id: unit.targetId,
    };
  }

  return {
    ts_ms: gameState.tsMs,
    units,
  };
}
