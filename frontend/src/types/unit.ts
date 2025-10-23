export type Side = 'BLUE' | 'RED';
export type Position = [number, number]; // [x, y] in meters
export type UnitTypeId = 'RECON' | 'INFANTRY' | 'MBT' | 'ARTILLERY';

// Matches the API response from /battle/local/state
export interface Unit {
  id: string;
  side: Side;
  unit_type_id: UnitTypeId;
  pos: Position;
  hp: number;
  ammo: number;
  routed: boolean;
  intent_target_pos: Position | null;
  target_id: string | null;
}
