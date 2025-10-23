import type { Position } from '../types';
import { SCALE } from './constants';

/**
 * Calculate 2D Euclidean distance between two positions
 */
export function distance2D(pos1: Position, pos2: Position): number {
  const dx = pos2[0] - pos1[0];
  const dy = pos2[1] - pos1[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Convert canvas coordinates to world coordinates
 */
export function canvasToWorld(canvasX: number, canvasY: number): Position {
  return [canvasX / SCALE, canvasY / SCALE];
}

/**
 * Convert world coordinates to canvas coordinates
 */
export function worldToCanvas(worldPos: Position): [number, number] {
  return [worldPos[0] * SCALE, worldPos[1] * SCALE];
}
