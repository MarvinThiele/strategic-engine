import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { BattleState, Position, Unit } from '../../types';
import { CANVAS_SIZE, BATTLEFIELD_SIZE, SCALE, GRID_SIZE, UNIT_CLICK_RADIUS } from '../../utils/constants';
import { canvasToWorld, distance2D, worldToCanvas } from '../../utils/geometry';
import { getUnitTypeDefinition } from '../../data/unitTypes';

interface PixiBattlefieldProps {
  state: BattleState | null;
  selectedUnitId: string | null;
  onUnitClick: (unitId: string) => void;
  onEmptyClick: (worldPos: Position) => void;
}

// Unit sprite container with visual elements
class UnitSprite extends Container {
  public unitId: string;
  private symbol: Graphics;
  private unitLabel: Text;
  private healthBar: Graphics;
  private rangeCircle: Graphics;

  constructor(unit: Unit) {
    super();
    this.unitId = unit.id;

    // Create symbol graphics
    this.symbol = new Graphics();
    this.addChild(this.symbol);

    // Create label
    const textStyle = new TextStyle({
      fontSize: 12,
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 2 }
    });
    this.unitLabel = new Text({ text: unit.id, style: textStyle });
    this.unitLabel.anchor.set(0.5, 0);
    this.unitLabel.position.set(0, 15);
    this.addChild(this.unitLabel);

    // Create health bar
    this.healthBar = new Graphics();
    this.addChild(this.healthBar);

    // Create range circle (initially hidden)
    this.rangeCircle = new Graphics();
    this.rangeCircle.visible = false;
    this.addChild(this.rangeCircle);

    // Make interactive
    this.eventMode = 'static';
    this.cursor = 'pointer';

    this.update(unit, false);
  }

  update(unit: Unit, isSelected: boolean): void {
    const unitType = getUnitTypeDefinition(unit.unit_type_id);
    const color = unit.side === 'BLUE' ? 0x4a9eff : 0xff4444;
    const size = 10;

    // Update symbol
    this.symbol.clear();

    switch (unit.unit_type_id) {
      case 'RECON':
        // Diamond shape
        this.symbol.poly([0, -size, size, 0, 0, size, -size, 0]);
        this.symbol.stroke({ width: 2.5, color });
        break;

      case 'INFANTRY':
        // X shape
        this.symbol.moveTo(-size * 0.7, -size * 0.7);
        this.symbol.lineTo(size * 0.7, size * 0.7);
        this.symbol.moveTo(size * 0.7, -size * 0.7);
        this.symbol.lineTo(-size * 0.7, size * 0.7);
        this.symbol.stroke({ width: 2.5, color });
        break;

      case 'MBT':
        // Rectangle with center line
        this.symbol.rect(-size * 0.8, -size * 0.6, size * 1.6, size * 1.2);
        this.symbol.moveTo(-size * 0.8, 0);
        this.symbol.lineTo(size * 0.8, 0);
        this.symbol.stroke({ width: 2.5, color });
        break;

      case 'ARTILLERY':
        // Circle with dot
        this.symbol.circle(0, 0, size * 0.8);
        this.symbol.stroke({ width: 2.5, color });
        this.symbol.circle(0, 0, size * 0.3);
        this.symbol.fill({ color });
        break;
    }

    // Selection highlight
    if (isSelected) {
      this.symbol.circle(0, 0, size * 1.5);
      this.symbol.stroke({ width: 2, color: 0xffff00 });
    }

    // Update health bar
    this.healthBar.clear();
    const hpPercent = unit.hp / 100;
    const barWidth = 20;
    const barHeight = 3;
    this.healthBar.rect(-barWidth / 2, -20, barWidth, barHeight);
    this.healthBar.fill({ color: 0x333333 });
    this.healthBar.rect(-barWidth / 2, -20, barWidth * hpPercent, barHeight);
    const hpColor = hpPercent > 0.5 ? 0x00ff00 : hpPercent > 0.25 ? 0xffff00 : 0xff0000;
    this.healthBar.fill({ color: hpColor });

    // Update range circle
    if (isSelected) {
      this.rangeCircle.visible = true;
      this.rangeCircle.clear();
      const rangeInPixels = unitType.sensorRangeM * SCALE;
      this.rangeCircle.circle(0, 0, rangeInPixels);
      this.rangeCircle.stroke({ width: 1, color: 0x00ffff, alpha: 0.3 });
    } else {
      this.rangeCircle.visible = false;
    }
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
  const unitSpritesRef = useRef<Map<string, UnitSprite>>(new Map());
  const backgroundRef = useRef<Container | null>(null);
  const unitContainerRef = useRef<Container | null>(null);

  // Find unit at world position
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

  // Draw grid background
  const drawGrid = (container: Container) => {
    const grid = new Graphics();

    // Grid lines
    for (let i = 0; i <= BATTLEFIELD_SIZE; i += GRID_SIZE) {
      const canvasPos = i * SCALE;
      // Vertical lines
      grid.moveTo(canvasPos, 0);
      grid.lineTo(canvasPos, CANVAS_SIZE);
      // Horizontal lines
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

    container.addChild(grid);
  };

  // Initialize Pixi app
  useEffect(() => {
    if (!containerRef.current) return;

    const initPixi = async () => {
      const app = new Application();
      await app.init({
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        backgroundColor: 0x1a1a1a,
        antialias: true,
      });

      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;

      // Create layers
      const background = new Container();
      backgroundRef.current = background;
      app.stage.addChild(background);

      const unitContainer = new Container();
      unitContainerRef.current = unitContainer;
      app.stage.addChild(unitContainer);

      // Draw grid
      drawGrid(background);

      // Handle clicks on stage
      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;
      app.stage.on('pointerdown', (event) => {
        const globalPos = event.global;
        const worldPos = canvasToWorld(globalPos.x, globalPos.y);

        // Check if clicked on a unit
        const clickedUnit = findUnitAt(worldPos);
        if (clickedUnit) {
          onUnitClick(clickedUnit.id);
        } else {
          onEmptyClick(worldPos);
        }
      });
    };

    initPixi();

    return () => {
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
    };
  }, [onUnitClick, onEmptyClick]);

  // Update unit sprites
  useEffect(() => {
    if (!state || !unitContainerRef.current) return;

    const unitContainer = unitContainerRef.current;
    const sprites = unitSpritesRef.current;

    // Get current unit IDs
    const currentUnitIds = new Set(Object.keys(state.units));
    const spriteIds = new Set(sprites.keys());

    // Remove destroyed units
    for (const id of spriteIds) {
      if (!currentUnitIds.has(id)) {
        const sprite = sprites.get(id);
        if (sprite) {
          unitContainer.removeChild(sprite);
          sprite.destroy();
          sprites.delete(id);
        }
      }
    }

    // Add or update units
    for (const unit of Object.values(state.units)) {
      let sprite = sprites.get(unit.id);

      if (!sprite) {
        // Create new sprite
        sprite = new UnitSprite(unit);
        sprites.set(unit.id, sprite);
        unitContainer.addChild(sprite);

        // Add click handler
        sprite.on('pointerdown', (event) => {
          event.stopPropagation();
          onUnitClick(unit.id);
        });
      }

      // Update sprite position and appearance
      const [canvasX, canvasY] = worldToCanvas(unit.pos);
      sprite.position.set(canvasX, canvasY);
      sprite.update(unit, unit.id === selectedUnitId);
    }
  }, [state, selectedUnitId, onUnitClick]);

  return (
    <div
      ref={containerRef}
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
