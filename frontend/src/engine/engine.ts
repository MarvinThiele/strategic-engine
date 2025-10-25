/**
 * Game engine - pure deterministic simulation logic
 * Ported from backend/engine/engine.py
 */

import type {
  GameState,
  Unit,
  Order,
  GameEvent,
  Position,
} from './model';
import { WeaponType, OrderKind, getUnitType } from './model';
import { DRNG } from './rng';

// Utility functions
export function distance2D(pos1: Position, pos2: Position): number {
  const dx = pos2[0] - pos1[0];
  const dy = pos2[1] - pos1[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export function normalize2D(vec: readonly [number, number]): readonly [number, number] {
  const mag = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1]);
  if (mag < 0.001) {
    return [0, 0];
  }
  return [vec[0] / mag, vec[1] / mag];
}

export class Engine {
  private state: GameState;
  private rng: DRNG;
  private pendingOrders: Order[] = [];
  private readonly baseAcc = 0.7;
  private readonly decayM = 800.0;

  constructor(seed: number, initialState: GameState) {
    this.state = initialState;
    this.rng = new DRNG(seed);
  }

  /**
   * Queue orders to be applied on next step
   */
  applyOrders(orders: Order[]): void {
    this.pendingOrders.push(...orders);
  }

  /**
   * Process queued orders and return events
   */
  private applyOrdersNow(): GameEvent[] {
    const evts: GameEvent[] = [];

    for (const order of this.pendingOrders) {
      const unit = this.state.units.get(order.unitId);
      if (!unit || unit.routed) {
        continue;
      }

      if (order.kind === OrderKind.MOVE && order.targetPos) {
        unit.intentTargetPos = order.targetPos;
        evts.push({
          kind: 'OrderAccepted',
          tsMs: this.state.tsMs,
          data: { unitId: unit.id, kind: 'move', to: [...unit.intentTargetPos] },
        });
      } else if (order.kind === OrderKind.ATTACK && order.targetId) {
        unit.targetId = order.targetId;
        evts.push({
          kind: 'OrderAccepted',
          tsMs: this.state.tsMs,
          data: { unitId: unit.id, kind: 'attack', target: unit.targetId },
        });
      } else if (order.kind === OrderKind.STOP) {
        unit.intentTargetPos = null;
        unit.targetId = null;
        evts.push({
          kind: 'OrderAccepted',
          tsMs: this.state.tsMs,
          data: { unitId: unit.id, kind: 'stop' },
        });
      }
    }

    this.pendingOrders = [];
    return evts;
  }

  /**
   * Update unit positions based on movement intents
   */
  private move(dtMs: number): GameEvent[] {
    const evts: GameEvent[] = [];
    const dt = dtMs / 1000.0;

    for (const unit of this.state.units.values()) {
      if (!unit.intentTargetPos || unit.routed) {
        continue;
      }

      const unitType = getUnitType(unit);

      // Calculate direction vector
      const dx = unit.intentTargetPos[0] - unit.pos[0];
      const dy = unit.intentTargetPos[1] - unit.pos[1];
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.1) {
        // Already at target
        continue;
      }

      // Normalize direction
      const dirX = dx / dist;
      const dirY = dy / dist;

      // Calculate step using unit type speed
      const maxStep = unitType.speedMps * dt;
      const step = Math.min(maxStep, dist);

      // Update position
      const newX = unit.pos[0] + dirX * step;
      const newY = unit.pos[1] + dirY * step;
      unit.pos = [newX, newY];

      // Don't emit UnitMoved events - too noisy for event log
    }

    return evts;
  }

  /**
   * Check if detector can see target based on visibility and sensor range
   */
  private canDetect(detector: Unit, target: Unit): boolean {
    const dist = distance2D(detector.pos, target.pos);
    const detType = getUnitType(detector);
    const tgtType = getUnitType(target);

    // Visibility multiplier - easy to spot targets extend effective range
    // No hard cap - a large visible target (tank) can be spotted beyond base sensor range
    // Example: 2500m sensor * 1.5 visibility = 3750m effective range vs tanks
    const effectiveRange = detType.sensorRangeM * tgtType.visibility;

    return dist <= effectiveRange;
  }

  /**
   * Update which enemy units are spotted by friendlies (shared vision)
   */
  private updateSpotting(): GameEvent[] {
    const evts: GameEvent[] = [];

    // Clear all spotting
    for (const unit of this.state.units.values()) {
      unit.spottedBy.clear();
    }

    // Update spotting
    for (const detector of this.state.units.values()) {
      if (detector.routed) {
        continue;
      }

      for (const target of this.state.units.values()) {
        if (detector.side !== target.side) {
          if (this.canDetect(detector, target)) {
            // Don't emit UnitDetected events - too spammy
            target.spottedBy.add(detector.id);
          }
        }
      }
    }

    return evts;
  }

  /**
   * Check if attacker can fire at target based on weapon type and reload
   */
  private canFireAt(attacker: Unit, target: Unit, currentTime: number): boolean {
    const aType = getUnitType(attacker);

    // Check reload time
    const timeSinceFire = (currentTime - attacker.lastFireTime) / 1000.0; // Convert to seconds
    if (timeSinceFire < aType.reloadTimeS) {
      return false;
    }

    // Check ammo
    if (attacker.ammo <= 0) {
      return false;
    }

    // Check range
    const dist = distance2D(attacker.pos, target.pos);
    if (dist > aType.weaponRangeM) {
      return false;
    }

    // Direct fire: must see target directly
    if (
      aType.weaponType === WeaponType.DIRECT_FIRE ||
      aType.weaponType === WeaponType.SMALL_ARMS ||
      aType.weaponType === WeaponType.ANTI_TANK
    ) {
      return this.canDetect(attacker, target);
    }

    // Indirect fire: someone must spot the target
    if (aType.weaponType === WeaponType.INDIRECT_FIRE) {
      return target.spottedBy.size > 0;
    }

    return false;
  }

  /**
   * Calculate damage based on weapon type vs armor
   */
  private calculateDamage(attacker: Unit, target: Unit, baseDamage: number): number {
    const aType = getUnitType(attacker);
    const tType = getUnitType(target);

    const weapon = aType.weaponType;
    const armor = tType.armor;

    // Small arms barely scratch armored vehicles
    if (weapon === WeaponType.SMALL_ARMS && armor >= 2) {
      return baseDamage * 0.1;
    }

    // Anti-tank weapons are effective against armor
    if (weapon === WeaponType.ANTI_TANK) {
      if (armor >= 2) {
        return baseDamage * 1.5;
      } else {
        return baseDamage;
      }
    }

    // Direct fire (tanks) good against medium armor, excellent vs light
    if (weapon === WeaponType.DIRECT_FIRE) {
      if (armor >= 3) {
        return baseDamage * 0.8;
      } else if (armor >= 2) {
        return baseDamage * 1.2;
      } else {
        return baseDamage * 1.5;
      }
    }

    // Indirect fire (HE artillery) devastating vs soft targets
    if (weapon === WeaponType.INDIRECT_FIRE) {
      if (armor === 0) {
        return baseDamage * 2.0;
      } else if (armor === 1) {
        return baseDamage * 1.2;
      } else {
        return baseDamage * 0.6;
      }
    }

    return baseDamage;
  }

  /**
   * Find valid targets for each unit
   */
  private findTargets(): Map<string, string> {
    const targets = new Map<string, string>();

    for (const [uId, unit] of this.state.units) {
      if (unit.routed) {
        continue;
      }

      // Find closest valid target
      let bestTarget: string | null = null;
      let bestDist = Infinity;

      for (const [tId, target] of this.state.units) {
        if (unit.side === target.side || target.hp <= 0) {
          continue;
        }

        if (this.canFireAt(unit, target, this.state.tsMs)) {
          const dist = distance2D(unit.pos, target.pos);
          if (dist < bestDist) {
            bestTarget = tId;
            bestDist = dist;
          }
        }
      }

      if (bestTarget) {
        targets.set(uId, bestTarget);
      }
    }

    return targets;
  }

  /**
   * Resolve combat between units and their targets
   * Uses CEP-based scatter and AOE damage
   */
  private combat(_dtMs: number, targets: Map<string, string>): GameEvent[] {
    const evts: GameEvent[] = [];

    for (const [shooterId, targetId] of targets) {
      const shooter = this.state.units.get(shooterId);
      const target = this.state.units.get(targetId);

      if (!shooter || !target || shooter.routed || target.hp <= 0) {
        continue;
      }

      const sType = getUnitType(shooter);
      const dist = distance2D(shooter.pos, target.pos);

      shooter.ammo -= 1;
      shooter.lastFireTime = this.state.tsMs;

      // Calculate impact point using CEP (Circular Error Probable)
      // CEP: 50% of shots land within this radius
      // We use Rayleigh distribution: r = CEP * sqrt(-2 * ln(1 - u)) where u ~ Uniform(0,1)
      // Simplified: use normal distribution approximation
      const cep = sType.cepM;
      const scatterDist = this.rng.normal(0, cep / 1.177); // sigma = CEP / 1.177 for Rayleigh
      const scatterAngle = this.rng.uniform(0, 2 * Math.PI);

      // Impact location relative to target
      const impactX = target.pos[0] + scatterDist * Math.cos(scatterAngle);
      const impactY = target.pos[1] + scatterDist * Math.sin(scatterAngle);
      const impactPos: Position = [impactX, impactY];

      // Calculate actual miss distance
      const missDistance = distance2D(target.pos, impactPos);

      evts.push({
        kind: 'ShotFired',
        tsMs: this.state.tsMs,
        data: {
          shooter: shooter.id,
          target: target.id,
          distM: dist,
          weapon: sType.weaponType,
        },
      });

      // Impact event (for visualization)
      evts.push({
        kind: 'Impact',
        tsMs: this.state.tsMs,
        data: {
          pos: impactPos,
          shooter: shooter.id,
          target: target.id,
          missDistance,
          weapon: sType.weaponType,
          aoeDamageRadius: sType.aoeDamageRadiusM,
        },
      });

      // Apply AOE damage to all units within damage radius
      const aoeRadius = sType.aoeDamageRadiusM;
      const baseDmg = sType.damage;

      if (aoeRadius > 0) {
        // AOE weapon - damage all units in radius
        for (const [victimId, victim] of this.state.units) {
          if (victim.hp <= 0) continue;

          const distFromImpact = distance2D(victim.pos, impactPos);

          if (distFromImpact <= aoeRadius) {
            // Damage falloff: 100% at center, 0% at edge
            const damageFactor = 1.0 - (distFromImpact / aoeRadius);
            const modifiedDmg = this.calculateDamage(shooter, victim, baseDmg * damageFactor);

            if (modifiedDmg > 0) {
              victim.hp -= modifiedDmg;
              evts.push({
                kind: 'Damage',
                tsMs: this.state.tsMs,
                data: {
                  target: victimId,
                  dmg: modifiedDmg,
                  hp: victim.hp,
                  shooter: shooter.id,
                  distFromImpact,
                },
              });

              if (victim.hp <= 0) {
                evts.push({
                  kind: 'Destroyed',
                  tsMs: this.state.tsMs,
                  data: { unitId: victimId, killer: shooter.id },
                });
              }
            }
          }
        }
      } else {
        // Direct-fire kinetic weapon - only damages if within CEP
        // Use weapon's CEP as effective "hit radius"
        const hitRadius = sType.cepM;

        if (missDistance <= hitRadius) {
          const finalDmg = this.calculateDamage(shooter, target, baseDmg);

          target.hp -= finalDmg;
          evts.push({
            kind: 'Damage',
            tsMs: this.state.tsMs,
            data: {
              target: target.id,
              dmg: finalDmg,
              hp: target.hp,
              shooter: shooter.id,
              distFromImpact: missDistance,
            },
          });

          if (target.hp <= 0) {
            evts.push({
              kind: 'Destroyed',
              tsMs: this.state.tsMs,
              data: { unitId: target.id, killer: shooter.id },
            });
          }
        }
      }
    }

    return evts;
  }

  /**
   * Check for unit routing based on damage
   */
  private morale(): GameEvent[] {
    const evts: GameEvent[] = [];

    for (const unit of this.state.units.values()) {
      if (unit.routed) {
        continue;
      }

      const unitType = getUnitType(unit);
      const hpPct = Math.max(0.0, unit.hp) / unitType.maxHp;

      if (hpPct < 0.3) {
        if (this.rng.bernoulli(0.5)) {
          unit.routed = true;
          evts.push({
            kind: 'Routed',
            tsMs: this.state.tsMs,
            data: { unitId: unit.id },
          });
        }
      }
    }

    return evts;
  }

  /**
   * Advance simulation by dtMs milliseconds
   */
  step(dtMs: number): GameEvent[] {
    const evts: GameEvent[] = [];
    evts.push(...this.applyOrdersNow());
    evts.push(...this.move(dtMs));
    evts.push(...this.updateSpotting());
    const targets = this.findTargets();
    evts.push(...this.combat(dtMs, targets));
    evts.push(...this.morale());
    this.state.tsMs += dtMs;
    return evts;
  }

  /**
   * Return current state
   */
  snapshot(): GameState {
    return this.state;
  }
}
