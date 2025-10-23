import type { UnitTypeId } from '../types';

export interface UnitTypeDefinition {
  name: string;
  sensorRangeM: number;
  weaponRangeM: number;
  maxHp: number;
  speedMps: number;
  visibility: number;  // How easy to spot (0.5=concealed, 1.0=normal, 1.5=visible)
}

// These match the backend UNIT_TYPES definitions
export const UNIT_TYPE_DEFINITIONS: Record<UnitTypeId, UnitTypeDefinition> = {
  RECON: {
    name: 'Reconnaissance Vehicle',
    sensorRangeM: 2500,  // Superior sensors - best in class
    weaponRangeM: 400,
    maxHp: 50,
    speedMps: 4.0,
    visibility: 0.5,  // Hard to spot - small, quiet, stealthy
  },
  INFANTRY: {
    name: 'Infantry Squad',
    sensorRangeM: 600,
    weaponRangeM: 500,
    maxHp: 80,
    speedMps: 1.5,
    visibility: 0.8,  // Can use cover, relatively small
  },
  MBT: {
    name: 'Main Battle Tank',
    sensorRangeM: 1000,
    weaponRangeM: 3000,
    maxHp: 150,
    speedMps: 2.0,
    visibility: 1.5,  // Easy to spot - large, hot engine, loud
  },
  ARTILLERY: {
    name: 'Self-Propelled Howitzer',
    sensorRangeM: 500,  // Poor sensors - needs spotters!
    weaponRangeM: 15000,  // Can shoot across map
    maxHp: 60,
    speedMps: 1.5,
    visibility: 1.2,  // Large vehicle, somewhat visible
  },
};

export function getUnitTypeDefinition(unitTypeId: UnitTypeId): UnitTypeDefinition {
  return UNIT_TYPE_DEFINITIONS[unitTypeId];
}

// Helper function to calculate detection ranges for tooltips
export function getDetectionRanges(detectorTypeId: UnitTypeId): {
  vsConcealed: number;
  vsStandard: number;
  vsVisible: number;
} {
  const detector = UNIT_TYPE_DEFINITIONS[detectorTypeId];
  return {
    vsConcealed: Math.round(detector.sensorRangeM * 0.5),   // vs 0.5 visibility
    vsStandard: Math.round(detector.sensorRangeM * 1.0),    // vs 1.0 visibility
    vsVisible: Math.round(detector.sensorRangeM * 1.5),     // vs 1.5 visibility
  };
}
