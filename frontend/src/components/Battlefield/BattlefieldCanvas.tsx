import { useEffect, useRef } from 'react';
import type { BattleState, Position, Unit, UnitTypeId } from '../../types';
import { CANVAS_SIZE, BATTLEFIELD_SIZE, SCALE, GRID_SIZE, UNIT_CLICK_RADIUS } from '../../utils/constants';
import { canvasToWorld, distance2D, worldToCanvas } from '../../utils/geometry';
import { getUnitTypeDefinition } from '../../data/unitTypes';

interface BattlefieldCanvasProps {
  state: BattleState | null;
  selectedUnitId: string | null;
  onUnitClick: (unitId: string) => void;
  onEmptyClick: (worldPos: Position) => void;
}

// Draw NATO-style symbols for each unit type
function drawUnitSymbol(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unitType: UnitTypeId,
  color: string,
  size: number
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;

  switch (unitType) {
    case 'RECON':
      // Diamond shape (NATO recon symbol simplified)
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size, y);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x - size, y);
      ctx.closePath();
      ctx.stroke();
      break;

    case 'INFANTRY':
      // X shape (NATO infantry symbol simplified)
      ctx.beginPath();
      ctx.moveTo(x - size * 0.7, y - size * 0.7);
      ctx.lineTo(x + size * 0.7, y + size * 0.7);
      ctx.moveTo(x + size * 0.7, y - size * 0.7);
      ctx.lineTo(x - size * 0.7, y + size * 0.7);
      ctx.stroke();
      break;

    case 'MBT':
      // Rectangle (NATO armor symbol)
      ctx.beginPath();
      ctx.rect(x - size * 0.8, y - size * 0.6, size * 1.6, size * 1.2);
      ctx.stroke();
      // Add center line
      ctx.beginPath();
      ctx.moveTo(x - size * 0.8, y);
      ctx.lineTo(x + size * 0.8, y);
      ctx.stroke();
      break;

    case 'ARTILLERY':
      // Circle with dot (NATO artillery symbol)
      ctx.beginPath();
      ctx.arc(x, y, size * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
  }

  ctx.restore();
}

export function BattlefieldCanvas({
  state,
  selectedUnitId,
  onUnitClick,
  onEmptyClick,
}: BattlefieldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Find unit at position
  const findUnitAt = (worldPos: Position): Unit | null => {
    if (!state) return null;

    for (const unit of Object.values(state.units)) {
      const dist = distance2D(unit.pos, worldPos);
      if (dist <= UNIT_CLICK_RADIUS) {
        return unit;
      }
    }
    return null;
  };

  // Handle canvas click
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const worldPos = canvasToWorld(clickX, clickY);
    const clickedUnit = findUnitAt(worldPos);

    if (clickedUnit) {
      onUnitClick(clickedUnit.id);
    } else {
      onEmptyClick(worldPos);
    }
  };

  // Handle hover
  const handleCanvasHover = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const hoverX = event.clientX - rect.left;
    const hoverY = event.clientY - rect.top;

    const worldPos = canvasToWorld(hoverX, hoverY);
    const hoveredUnit = findUnitAt(worldPos);

    canvas.style.cursor = hoveredUnit ? 'pointer' : 'crosshair';
  };

  // Render battlefield
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw grid
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= BATTLEFIELD_SIZE; i += GRID_SIZE) {
      const pos = i * SCALE;
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, CANVAS_SIZE);
      ctx.stroke();
      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(CANVAS_SIZE, pos);
      ctx.stroke();

      // Labels
      if (i % 2000 === 0) {
        ctx.fillStyle = '#555';
        ctx.font = '10px monospace';
        ctx.fillText(`${i / 1000}km`, pos + 2, 12);
        ctx.fillText(`${i / 1000}km`, 2, pos + 12);
      }
    }

    // Draw units
    Object.values(state.units).forEach((unit) => {
      const [x, y] = worldToCanvas(unit.pos);
      const color = unit.side === 'BLUE' ? '#4080ff' : '#ff4040';
      const size = 16;
      const isSelected = unit.id === selectedUnitId;
      const unitTypeDef = getUnitTypeDefinition(unit.unit_type_id);

      // Draw sensor range (light circle) - unique per unit type
      const sensorRangePixels = unitTypeDef.sensorRangeM * SCALE;
      ctx.strokeStyle = color + '20';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, sensorRangePixels, 0, Math.PI * 2);
      ctx.stroke();

      // Draw weapon range for selected unit (helps understand capabilities)
      if (isSelected) {
        const weaponRangePixels = unitTypeDef.weaponRangeM * SCALE;
        ctx.strokeStyle = '#ff8800' + '30';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.arc(x, y, weaponRangePixels, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw selection indicator
      if (isSelected) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, size + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw NATO symbol
      const symbolColor = unit.routed ? '#666' : color;
      drawUnitSymbol(ctx, x, y, unit.unit_type_id, symbolColor, size);

      // Unit label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(unit.id, x, y - size - 10);

      // HP bar
      const hpWidth = 40;
      const hpHeight = 4;
      const hpRatio = Math.max(0, unit.hp / 100);
      ctx.fillStyle = '#222';
      ctx.fillRect(x - hpWidth / 2, y + size + 10, hpWidth, hpHeight);
      ctx.fillStyle = hpRatio > 0.5 ? '#4f4' : hpRatio > 0.25 ? '#ff4' : '#f44';
      ctx.fillRect(x - hpWidth / 2, y + size + 10, hpWidth * hpRatio, hpHeight);

      // Movement intent indicator
      if (unit.intent_target_pos && !unit.routed) {
        const [targetX, targetY] = worldToCanvas(unit.intent_target_pos);
        ctx.strokeStyle = color + '60';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw target marker
        ctx.fillStyle = color + '40';
        ctx.beginPath();
        ctx.arc(targetX, targetY, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.textAlign = 'left'; // Reset
  }, [state, selectedUnitId]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      onClick={handleCanvasClick}
      onMouseMove={handleCanvasHover}
      style={{
        border: '2px solid #3a3a3a',
        borderRadius: '5px',
        background: '#2a2a2a',
        cursor: 'crosshair',
      }}
    />
  );
}
