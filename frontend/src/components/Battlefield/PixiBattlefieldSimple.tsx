import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { BattleState, Position } from '../../types';
import { CANVAS_SIZE, BATTLEFIELD_SIZE, SCALE, GRID_SIZE } from '../../utils/constants';
import { worldToCanvas } from '../../utils/geometry';
import { getUnitTypeDefinition } from '../../data/unitTypes';

interface PixiBattlefieldProps {
  state: BattleState | null;
  selectedUnitId: string | null;
  onUnitClick: (unitId: string) => void;
  onEmptyClick: (worldPos: Position) => void;
}

// Draw NATO symbol for unit type
function drawUnitSymbol(graphics: Graphics, unitTypeId: string, color: number, size: number) {
  graphics.clear();

  switch (unitTypeId) {
    case 'RECON':
      // Diamond shape
      graphics.poly([0, -size, size, 0, 0, size, -size, 0]);
      graphics.stroke({ width: 2.5, color });
      break;

    case 'INFANTRY':
      // X shape
      graphics.moveTo(-size * 0.7, -size * 0.7);
      graphics.lineTo(size * 0.7, size * 0.7);
      graphics.moveTo(size * 0.7, -size * 0.7);
      graphics.lineTo(-size * 0.7, size * 0.7);
      graphics.stroke({ width: 2.5, color });
      break;

    case 'MBT':
      // Rectangle with center line
      graphics.rect(-size * 0.8, -size * 0.6, size * 1.6, size * 1.2);
      graphics.moveTo(-size * 0.8, 0);
      graphics.lineTo(size * 0.8, 0);
      graphics.stroke({ width: 2.5, color });
      break;

    case 'ARTILLERY':
      // Circle with dot
      graphics.circle(0, 0, size * 0.8);
      graphics.stroke({ width: 2.5, color });
      graphics.circle(0, 0, size * 0.3);
      graphics.fill({ color });
      break;
  }
}

export function PixiBattlefield({
  state,
  selectedUnitId,
  onUnitClick,
  onEmptyClick,
}: PixiBattlefieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const [pixiReady, setPixiReady] = useState(false);

  // Initialize Pixi app
  useEffect(() => {
    if (!containerRef.current) return;
    if (appRef.current) return; // Prevent double init in strict mode

    const initPixi = async () => {
      console.log('[Pixi] Starting initialization...');
      const app = new Application();
      await app.init({
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        backgroundColor: 0x1a1a1a,
        antialias: true,
      });

      if (containerRef.current) {
        containerRef.current.appendChild(app.canvas);
        appRef.current = app;

        console.log('[Pixi] Initialized successfully', app);

        // Draw grid
        const grid = new Graphics();

        // Grid lines
        for (let i = 0; i <= BATTLEFIELD_SIZE; i += GRID_SIZE) {
          const canvasPos = i * SCALE;
          grid.moveTo(canvasPos, 0);
          grid.lineTo(canvasPos, CANVAS_SIZE);
          grid.moveTo(0, canvasPos);
          grid.lineTo(CANVAS_SIZE, canvasPos);
        }
        grid.stroke({ width: 1, color: 0x333333, alpha: 0.3 });

        // Border
        grid.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        grid.stroke({ width: 2, color: 0x666666 });

        // Grid labels (km markers)
        for (let i = 0; i <= BATTLEFIELD_SIZE; i += 1000) {
          const canvasPos = i * SCALE;
          const km = i / 1000;
          const textStyle = new TextStyle({ fontSize: 10, fill: 0x888888 });
          const text = new Text({ text: `${km}`, style: textStyle });
          text.position.set(canvasPos + 2, 2);
          grid.addChild(text);
        }

        app.stage.addChild(grid);
        console.log('[Pixi] Added grid');

        // Handle clicks on empty space
        app.stage.eventMode = 'static';
        app.stage.hitArea = app.screen;

        app.stage.on('pointerdown', (event) => {
          const globalPos = event.global;
          const worldX = globalPos.x / SCALE;
          const worldY = globalPos.y / SCALE;

          console.log('[Pixi] Click on empty space, button:', event.button);

          // Button 0 = left click, Button 2 = right click
          if (event.button === 0) {
            console.log('[Pixi] Left click - deselect');
            onEmptyClick([worldX, worldY]); // This will deselect if no unit selected
          } else if (event.button === 2) {
            console.log('[Pixi] Right click - move order');
            onEmptyClick([worldX, worldY]); // This will set move target if unit selected
          }
        });

        setPixiReady(true);
      }
    };

    initPixi();

    return () => {
      if (appRef.current) {
        console.log('[Pixi] Destroying app');
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
        setPixiReady(false);
      }
    };
  }, []);

  // Draw units
  useEffect(() => {
    console.log('[Pixi] Draw units effect triggered', { hasState: !!state, pixiReady, hasApp: !!appRef.current });

    if (!pixiReady || !appRef.current) {
      console.log('[Pixi] Pixi not ready yet, skipping draw');
      return;
    }

    if (!state) {
      console.log('[Pixi] No state yet, skipping draw');
      return;
    }

    const app = appRef.current;

    // Clear previous units (keep grid as first child)
    console.log('[Pixi] Current children count:', app.stage.children.length);
    while (app.stage.children.length > 1) {
      app.stage.removeChildAt(1);
    }

    const unitCount = Object.keys(state.units).length;
    console.log('[Pixi] Drawing', unitCount, 'units');

    // Draw each unit with NATO symbol
    let drawn = 0;
    for (const unit of Object.values(state.units)) {
      try {
        const [canvasX, canvasY] = worldToCanvas(unit.pos);
        const color = unit.side === 'BLUE' ? 0x4a9eff : 0xff4444;
        const isSelected = unit.id === selectedUnitId;

        // Create container for unit
        const unitContainer = new Container();
        unitContainer.position.set(canvasX, canvasY);

        // Draw NATO symbol
        const symbol = new Graphics();
        drawUnitSymbol(symbol, unit.unit_type_id, color, 10);
        unitContainer.addChild(symbol);

        // Selection highlight
        if (isSelected) {
          const highlight = new Graphics();
          highlight.circle(0, 0, 18);
          highlight.stroke({ width: 2, color: 0xffff00 });
          unitContainer.addChild(highlight);
        }

        // Unit label
        const textStyle = new TextStyle({
          fontSize: 10,
          fill: 0xffffff,
          stroke: { color: 0x000000, width: 2 }
        });
        const label = new Text({ text: unit.id, style: textStyle });
        label.anchor.set(0.5, 0);
        label.position.set(0, 15);
        unitContainer.addChild(label);

        // Health bar
        const hpPercent = unit.hp / 100;
        const barWidth = 24;
        const barHeight = 3;
        const healthBar = new Graphics();
        healthBar.rect(-barWidth / 2, -18, barWidth, barHeight);
        healthBar.fill({ color: 0x333333 });
        healthBar.rect(-barWidth / 2, -18, barWidth * hpPercent, barHeight);
        const hpColor = hpPercent > 0.5 ? 0x00ff00 : hpPercent > 0.25 ? 0xffff00 : 0xff0000;
        healthBar.fill({ color: hpColor });
        unitContainer.addChild(healthBar);

        // Detection range circle (if selected)
        if (isSelected) {
          const unitType = getUnitTypeDefinition(unit.unit_type_id);
          const rangeInPixels = unitType.sensorRangeM * SCALE;
          const rangeCircle = new Graphics();
          rangeCircle.circle(0, 0, rangeInPixels);
          rangeCircle.stroke({ width: 1, color: 0x00ffff, alpha: 0.3 });
          unitContainer.addChild(rangeCircle);
        }

        // Make interactive
        unitContainer.eventMode = 'static';
        unitContainer.cursor = 'pointer';

        unitContainer.on('pointerdown', (event) => {
          event.stopPropagation();
          console.log('[Pixi] Click on unit', unit.id, 'button:', event.button);

          if (event.button === 0) {
            // Left click = select unit
            console.log('[Pixi] Left click - selecting unit', unit.id);
            onUnitClick(unit.id);
          } else if (event.button === 2) {
            // Right click on enemy unit = attack order (future feature)
            console.log('[Pixi] Right click on unit', unit.id, '(attack order - TODO)');
          }
        });

        app.stage.addChild(unitContainer);
        drawn++;
      } catch (err) {
        console.error('[Pixi] Error drawing unit', unit.id, err);
      }
    }

    console.log('[Pixi] Successfully drew', drawn, 'units. Total children:', app.stage.children.length);
  }, [state, onUnitClick, selectedUnitId, pixiReady]);

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()} // Prevent right-click context menu
      style={{
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        margin: '0 auto',
        border: '2px solid #333',
        borderRadius: '4px'
      }}
    />
  );
}
