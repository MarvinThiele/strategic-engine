/**
 * Core game model - types and data structures
 * Ported from backend/engine/model.py
 */

export type Side = 'BLUE' | 'RED';
export type Position = readonly [number, number]; // [x, y] in meters

// Weapon types
export const WeaponType = {
  DIRECT_FIRE: 'direct_fire',      // Tanks, IFVs - must see target
  INDIRECT_FIRE: 'indirect_fire',  // Artillery - can fire at spotted targets
  SMALL_ARMS: 'small_arms',        // Infantry rifles
  ANTI_TANK: 'anti_tank',          // AT missiles
} as const;

export type WeaponType = typeof WeaponType[keyof typeof WeaponType];

// Unit classifications
export const UnitClass = {
  RECON: 'recon',
  INFANTRY: 'infantry',
  MBT: 'mbt',
  ARTILLERY: 'artillery',
} as const;

export type UnitClass = typeof UnitClass[keyof typeof UnitClass];

// Unit type template
export interface UnitType {
  name: string;
  unitClass: UnitClass;
  maxHp: number;
  speedMps: number;
  sensorRangeM: number;
  weaponType: WeaponType;
  weaponRangeM: number;
  damage: number;
  reloadTimeS: number;
  armor: number;  // 0=none, 1=light, 2=medium, 3=heavy
  visibility: number;  // How easy to spot (0.5=concealed, 1.0=normal, 1.5=visible)
  maxAmmo: number;
  cepM: number;  // Circular Error Probable - 50% of shots land within this radius
  aoeDamageRadiusM: number;  // Area of effect damage radius (0 for direct-fire kinetic rounds)
}

// Predefined unit types
export const UNIT_TYPES: Record<string, UnitType> = {
  RECON: {
    name: 'Reconnaissance Vehicle',
    unitClass: UnitClass.RECON,
    maxHp: 50,
    speedMps: 4.0,
    sensorRangeM: 2500,  // Superior sensors - best in class
    weaponType: WeaponType.SMALL_ARMS,
    weaponRangeM: 400,
    damage: 5,
    reloadTimeS: 2.0,
    armor: 1,
    visibility: 0.5,  // Hard to spot - small, quiet, stealthy
    maxAmmo: 200,
    cepM: 2,  // Very accurate small arms
    aoeDamageRadiusM: 0,  // Bullets don't have AOE
  },
  INFANTRY: {
    name: 'Infantry Squad',
    unitClass: UnitClass.INFANTRY,
    maxHp: 80,
    speedMps: 1.5,
    sensorRangeM: 600,
    weaponType: WeaponType.ANTI_TANK,
    weaponRangeM: 500,
    damage: 30,
    reloadTimeS: 5.0,
    armor: 0,
    visibility: 0.8,  // Can use cover, relatively small
    maxAmmo: 10,
    cepM: 10,  // AT missiles - guided but not perfect
    aoeDamageRadiusM: 5,  // Small explosion from HEAT warhead
  },
  MBT: {
    name: 'Main Battle Tank',
    unitClass: UnitClass.MBT,
    maxHp: 150,
    speedMps: 2.0,
    sensorRangeM: 1000,
    weaponType: WeaponType.DIRECT_FIRE,
    weaponRangeM: 3000,
    damage: 50,
    reloadTimeS: 6.0,
    armor: 3,
    visibility: 1.5,  // Easy to spot - large, hot engine, loud
    maxAmmo: 40,
    cepM: 5,  // Modern tank gun - very accurate
    aoeDamageRadiusM: 0,  // APFSDS kinetic penetrator - no AOE
  },
  ARTILLERY: {
    name: 'Self-Propelled Howitzer',
    unitClass: UnitClass.ARTILLERY,
    maxHp: 60,
    speedMps: 1.5,
    sensorRangeM: 500,  // Poor sensors - needs spotters
    weaponType: WeaponType.INDIRECT_FIRE,
    weaponRangeM: 15000,
    damage: 60,
    reloadTimeS: 15.0,
    armor: 1,
    visibility: 1.2,  // Large vehicle, somewhat visible
    maxAmmo: 30,
    cepM: 250,  // Artillery has significant scatter at long range
    aoeDamageRadiusM: 20,  // HE shells have substantial blast radius
  },
};

// Unit instance
export interface Unit {
  id: string;
  side: Side;
  unitTypeId: string;  // Key into UNIT_TYPES
  pos: Position;
  hp: number;
  ammo: number;
  targetId: string | null;
  intentTargetPos: Position | null;
  routed: boolean;
  lastFireTime: number;  // For reload tracking (ms)
  spottedBy: Set<string>;  // IDs of friendly units that spot this enemy
}

// Helper to get unit type
export function getUnitType(unit: Unit): UnitType {
  return UNIT_TYPES[unit.unitTypeId];
}

// Order types
export const OrderKind = {
  MOVE: 'move',
  ATTACK: 'attack',
  STOP: 'stop',
} as const;

export type OrderKind = typeof OrderKind[keyof typeof OrderKind];

export interface Order {
  kind: OrderKind;
  unitId: string;
  targetPos?: Position;
  targetId?: string;
}

// Event types
export interface GameEvent {
  kind: string;
  tsMs: number;
  data: Record<string, any>;
}

// Game state
export interface GameState {
  tsMs: number;
  units: Map<string, Unit>;
  battleId: string;
}

// Helper to create initial state
export function createInitialState(): GameState {
  const units = new Map<string, Unit>();

  // BLUE Force: Combined arms group
  units.set('B-RECON-1', {
    id: 'B-RECON-1',
    side: 'BLUE',
    unitTypeId: 'RECON',
    pos: [5000, 5000],
    hp: 50,
    ammo: 200,
    targetId: null,
    intentTargetPos: null,
    routed: false,
    lastFireTime: 0,
    spottedBy: new Set(),
  });

  units.set('B-INF-1', {
    id: 'B-INF-1',
    side: 'BLUE',
    unitTypeId: 'INFANTRY',
    pos: [1500, 3000],
    hp: 80,
    ammo: 10,
    targetId: null,
    intentTargetPos: null,
    routed: false,
    lastFireTime: 0,
    spottedBy: new Set(),
  });

  units.set('B-INF-2', {
    id: 'B-INF-2',
    side: 'BLUE',
    unitTypeId: 'INFANTRY',
    pos: [1500, 7000],
    hp: 80,
    ammo: 10,
    targetId: null,
    intentTargetPos: null,
    routed: false,
    lastFireTime: 0,
    spottedBy: new Set(),
  });

  units.set('B-MBT-1', {
    id: 'B-MBT-1',
    side: 'BLUE',
    unitTypeId: 'MBT',
    pos: [2000, 4000],
    hp: 150,
    ammo: 40,
    targetId: null,
    intentTargetPos: null,
    routed: false,
    lastFireTime: 0,
    spottedBy: new Set(),
  });

  units.set('B-MBT-2', {
    id: 'B-MBT-2',
    side: 'BLUE',
    unitTypeId: 'MBT',
    pos: [2000, 6000],
    hp: 150,
    ammo: 40,
    targetId: null,
    intentTargetPos: null,
    routed: false,
    lastFireTime: 0,
    spottedBy: new Set(),
  });

  units.set('B-ARTY-1', {
    id: 'B-ARTY-1',
    side: 'BLUE',
    unitTypeId: 'ARTILLERY',
    pos: [500, 5000],
    hp: 60,
    ammo: 30,
    targetId: null,
    intentTargetPos: null,
    routed: false,
    lastFireTime: 0,
    spottedBy: new Set(),
  });

  // RED Force: Combined arms group
  units.set('R-RECON-1', {
    id: 'R-RECON-1',
    side: 'RED',
    unitTypeId: 'RECON',
    pos: [9000, 5000],
    hp: 50,
    ammo: 200,
    targetId: null,
    intentTargetPos: null,
    routed: false,
    lastFireTime: 0,
    spottedBy: new Set(),
  });

  units.set('R-INF-1', {
    id: 'R-INF-1',
    side: 'RED',
    unitTypeId: 'INFANTRY',
    pos: [8500, 3000],
    hp: 80,
    ammo: 10,
    targetId: null,
    intentTargetPos: null,
    routed: false,
    lastFireTime: 0,
    spottedBy: new Set(),
  });

  units.set('R-INF-2', {
    id: 'R-INF-2',
    side: 'RED',
    unitTypeId: 'INFANTRY',
    pos: [8500, 7000],
    hp: 80,
    ammo: 10,
    targetId: null,
    intentTargetPos: null,
    routed: false,
    lastFireTime: 0,
    spottedBy: new Set(),
  });

  units.set('R-MBT-1', {
    id: 'R-MBT-1',
    side: 'RED',
    unitTypeId: 'MBT',
    pos: [8000, 4000],
    hp: 150,
    ammo: 40,
    targetId: null,
    intentTargetPos: null,
    routed: false,
    lastFireTime: 0,
    spottedBy: new Set(),
  });

  units.set('R-MBT-2', {
    id: 'R-MBT-2',
    side: 'RED',
    unitTypeId: 'MBT',
    pos: [8000, 6000],
    hp: 150,
    ammo: 40,
    targetId: null,
    intentTargetPos: null,
    routed: false,
    lastFireTime: 0,
    spottedBy: new Set(),
  });

  units.set('R-ARTY-1', {
    id: 'R-ARTY-1',
    side: 'RED',
    unitTypeId: 'ARTILLERY',
    pos: [9500, 5000],
    hp: 60,
    ammo: 30,
    targetId: null,
    intentTargetPos: null,
    routed: false,
    lastFireTime: 0,
    spottedBy: new Set(),
  });

  return {
    tsMs: 0,
    units,
    battleId: 'local',
  };
}
