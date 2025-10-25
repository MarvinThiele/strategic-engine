/**
 * Full Pixi.js RTS Game
 * No React - pure Pixi rendering for maximum performance
 */

import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Engine } from '../engine/engine';
import { GameLoop } from '../engine/gameLoop';
import { createInitialState, getUnitType } from '../engine/model';
import type { GameState, GameEvent, Order, Unit } from '../engine/model';
import { WeaponType } from '../engine/model';

// Projectile for visual effects
interface Projectile {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  currentX: number;
  currentY: number;
  speed: number; // meters per second
  weaponType: string;
  startTime: number;
  color: number;
  impactData?: {
    aoeRadius: number;
    missDistance: number;
  };
}

// Impact crater/explosion effect
interface ImpactEffect {
  x: number;
  y: number;
  createdTime: number;
  weapon: string;
  aoeRadius: number;
  missDistance: number;
}

// Explosion animation
interface Explosion {
  x: number;
  y: number;
  startTime: number;
  duration: number; // milliseconds
  maxRadius: number;
  weapon: string;
}

// Layout constants (will be set dynamically based on window size)
let SCREEN_WIDTH = window.innerWidth;
let SCREEN_HEIGHT = window.innerHeight;
const LEFT_PANEL_WIDTH = 260;
const RIGHT_PANEL_WIDTH = 400;
let BATTLEFIELD_WIDTH = SCREEN_WIDTH - LEFT_PANEL_WIDTH - RIGHT_PANEL_WIDTH;
let BATTLEFIELD_HEIGHT = SCREEN_HEIGHT;

// Colors
const BG_COLOR = 0x1a1a2e;
const PANEL_BG = 0x16213e;
const PANEL_BORDER = 0x0f3460;
const TEXT_COLOR = 0xe94560;
const TEXT_SECONDARY = 0xaaaaaa;

// Helper function for linear interpolation
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

export class PixiGame {
  private app: Application;
  private engine!: Engine;
  private gameLoop!: GameLoop;
  private gameState!: GameState;

  // UI Containers
  private leftPanel!: Container;
  private battlefield!: Container;
  private rightPanel!: Container;

  // Right panel UI
  private unitInfoContainer!: Container;
  private timeControlsContainer!: Container;
  private eventLogContainer!: Container;
  private currentEvents: GameEvent[] = [];

  // State
  private selectedUnitId: string | null = null;
  private selectedUnitIds: Set<string> = new Set();
  private currentSpeed: number = 1.0;
  private showAllRanges: boolean = false;
  private fogOfWarEnabled: boolean = true;

  // Box selection state
  private isBoxSelecting: boolean = false;
  private boxSelectStart: { x: number; y: number } | null = null;
  private selectionBox: Graphics | null = null;

  // Projectile system
  private projectiles: Projectile[] = [];

  // Impact effects and explosions
  private impactCraters: ImpactEffect[] = [];
  private explosions: Explosion[] = [];

  // Interpolation state (kept for future use if needed)
  private previousUnitPositions: Map<string, readonly [number, number]> = new Map();
  private lastEngineUpdateTime: number = 0;
  private tickIntervalMs: number = 16;

  // Camera/Viewport state
  private viewport!: Container;
  private battlefieldGrid!: Graphics;
  private gridLabels: Text[] = [];
  private scaleBar!: Container;
  private zoom: number = 1.0;
  private minZoom: number = 0.5;  // See 20km at max zoom-out
  private maxZoom: number = 4.0;   // See 2.5km at max zoom-in
  private panX: number = 0;
  private panY: number = 0;
  private isPanning: boolean = false;
  private panStart: { x: number; y: number } | null = null;

  constructor() {
    this.app = new Application();
    // Initialize in async init() method
  }

  async init() {
    // Initialize Pixi with fullscreen
    await this.app.init({
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      backgroundColor: BG_COLOR,
      antialias: true,
      resizeTo: window, // Auto-resize to window
    });

    console.log('[PixiGame] Initialized fullscreen', SCREEN_WIDTH, 'x', SCREEN_HEIGHT);

    // Initialize game engine
    this.gameState = createInitialState();
    this.engine = new Engine(42, this.gameState);
    this.gameLoop = new GameLoop(
      this.engine,
      16, // 16ms tick (~60 FPS) - smooth movement!
      1.0, // 1x speed (default)
      (state) => this.onStateUpdate(state),
      (events) => this.onEvents(events)
    );

    // Create UI layout
    this.createLayout();

    // Handle window resize
    window.addEventListener('resize', () => this.handleResize());

    // Initialize interpolation timestamp
    this.lastEngineUpdateTime = performance.now();

    // Start game loop
    this.gameLoop.start();
    console.log('[PixiGame] Game loop started');

    // Start Pixi ticker for smooth 60 FPS rendering
    this.app.ticker.add(() => this.render());

    return this.app.canvas;
  }

  private handleResize() {
    SCREEN_WIDTH = window.innerWidth;
    SCREEN_HEIGHT = window.innerHeight;
    BATTLEFIELD_WIDTH = SCREEN_WIDTH - LEFT_PANEL_WIDTH - RIGHT_PANEL_WIDTH;
    BATTLEFIELD_HEIGHT = SCREEN_HEIGHT;

    console.log('[PixiGame] Resized to', SCREEN_WIDTH, 'x', SCREEN_HEIGHT);

    // Recreate layout with new dimensions
    this.app.stage.removeChildren();
    this.createLayout();
    // Note: render() called by Pixi ticker
  }

  private createLayout() {
    // Left panel - Unit list
    this.leftPanel = new Container();
    this.leftPanel.position.set(0, 0);
    this.drawPanel(this.leftPanel, LEFT_PANEL_WIDTH, SCREEN_HEIGHT, 'Units');
    this.app.stage.addChild(this.leftPanel);

    // Battlefield - center
    this.battlefield = new Container();
    this.battlefield.position.set(LEFT_PANEL_WIDTH, 0);
    this.drawBattlefield();
    this.app.stage.addChild(this.battlefield);

    // Right panel - Orders + controls
    this.rightPanel = new Container();
    this.rightPanel.position.set(LEFT_PANEL_WIDTH + BATTLEFIELD_WIDTH, 0);
    this.drawPanel(this.rightPanel, RIGHT_PANEL_WIDTH, SCREEN_HEIGHT, 'Orders');
    this.drawRightPanelUI();
    this.app.stage.addChild(this.rightPanel);

    console.log('[PixiGame] Layout created');
  }

  private drawRightPanelUI() {
    // Unit info section (top)
    this.unitInfoContainer = new Container();
    this.unitInfoContainer.position.set(0, 50);
    this.rightPanel.addChild(this.unitInfoContainer);

    // Time controls section (middle)
    this.timeControlsContainer = new Container();
    this.timeControlsContainer.position.set(0, 210);
    this.drawTimeControls();
    this.rightPanel.addChild(this.timeControlsContainer);

    // Event log section (bottom)
    this.eventLogContainer = new Container();
    this.eventLogContainer.position.set(0, 430);  // Moved down to make room for reset button
    this.drawEventLog();
    this.rightPanel.addChild(this.eventLogContainer);
  }

  private drawTimeControls() {
    // Title
    const titleStyle = new TextStyle({ fontSize: 14, fill: TEXT_COLOR, fontWeight: 'bold' });
    const title = new Text({ text: 'Time Control', style: titleStyle });
    title.position.set(10, 0);
    this.timeControlsContainer.addChild(title);

    // Current time display
    const timeStyle = new TextStyle({ fontSize: 12, fill: TEXT_SECONDARY });
    const timeText = new Text({ text: 'Time: 0:00', style: timeStyle });
    timeText.position.set(10, 25);
    timeText.name = 'timeDisplay';
    this.timeControlsContainer.addChild(timeText);

    // Current speed display
    const speedText = new Text({ text: `Speed: ${this.currentSpeed}x`, style: timeStyle });
    speedText.position.set(10, 45);
    speedText.name = 'speedDisplay';
    this.timeControlsContainer.addChild(speedText);

    // Zoom display
    const zoomText = new Text({ text: `Zoom: ${this.zoom.toFixed(1)}x`, style: timeStyle });
    zoomText.position.set(200, 45);
    zoomText.name = 'zoomDisplay';
    this.timeControlsContainer.addChild(zoomText);

    // Speed slider
    const sliderY = 75;
    const sliderX = 10;
    const sliderWidth = 350;
    const sliderHeight = 6;

    // Slider label
    const sliderLabelStyle = new TextStyle({ fontSize: 11, fill: TEXT_SECONDARY });
    const sliderLabel = new Text({ text: 'Speed:', style: sliderLabelStyle });
    sliderLabel.position.set(sliderX, sliderY - 15);
    this.timeControlsContainer.addChild(sliderLabel);

    // Slider track
    const sliderTrack = new Graphics();
    sliderTrack.rect(sliderX, sliderY, sliderWidth, sliderHeight);
    sliderTrack.fill({ color: 0x2a3a4a });
    sliderTrack.stroke({ width: 1, color: 0x3a4a5a });
    this.timeControlsContainer.addChild(sliderTrack);

    // Tick marks and labels for key speeds (0, 0.5, 1, 10, 30, 60, 100)
    const tickSpeeds = [0, 0.5, 1, 10, 30, 60, 100];
    const maxSpeed = 100;
    for (const tickSpeed of tickSpeeds) {
      const tickX = sliderX + (tickSpeed / maxSpeed) * sliderWidth;
      const tick = new Graphics();
      tick.rect(tickX - 1, sliderY + sliderHeight, 2, 4);
      tick.fill({ color: 0x5a6a7a });
      this.timeControlsContainer.addChild(tick);

      const tickLabel = new Text({
        text: tickSpeed === 0 ? 'Pause' : `${tickSpeed}x`,
        style: new TextStyle({ fontSize: 9, fill: TEXT_SECONDARY })
      });
      tickLabel.anchor.set(0.5, 0);
      tickLabel.position.set(tickX, sliderY + sliderHeight + 6);
      this.timeControlsContainer.addChild(tickLabel);
    }

    // Slider handle - position based on current speed
    const handleRadius = 8;
    const handleX = sliderX + (this.currentSpeed / maxSpeed) * sliderWidth;
    const sliderHandle = new Graphics();
    sliderHandle.circle(0, sliderHeight / 2, handleRadius);
    sliderHandle.fill({ color: 0x4a9eff });
    sliderHandle.stroke({ width: 2, color: 0x6a9eff });
    sliderHandle.position.set(handleX, sliderY);
    sliderHandle.eventMode = 'static';
    sliderHandle.cursor = 'pointer';
    sliderHandle.name = 'speedSliderHandle';

    // Make slider interactive
    let isDragging = false;
    const updateSlider = (globalX: number) => {
      const containerBounds = this.timeControlsContainer.getBounds();
      const localX = globalX - containerBounds.x - sliderX;
      const clampedX = Math.max(0, Math.min(sliderWidth, localX));
      let newSpeed = (clampedX / sliderWidth) * maxSpeed;

      // Snap to zero if very close
      if (newSpeed < 0.5) {
        newSpeed = 0;
      }

      // Round to 1 decimal place for display
      newSpeed = Math.round(newSpeed * 10) / 10;

      // Only update if speed actually changed
      if (Math.abs(newSpeed - this.currentSpeed) > 0.05) {
        this.currentSpeed = newSpeed;
        this.gameLoop.setTimeCompression(newSpeed);

        // Update speed display text
        const speedDisplay = this.timeControlsContainer.getChildByName('speedDisplay') as Text;
        if (speedDisplay) {
          speedDisplay.text = `Speed: ${newSpeed.toFixed(1)}x`;
        }

        // Update handle position to exact position
        const newHandleX = sliderX + (newSpeed / maxSpeed) * sliderWidth;
        sliderHandle.position.set(newHandleX, sliderY);
      }
    };

    // Track both handle and track drags separately
    let handleDragging = false;
    let trackDragging = false;

    const onPointerMove = (event: any) => {
      if (handleDragging || trackDragging) {
        updateSlider(event.global.x);
      }
    };

    const onPointerUp = () => {
      handleDragging = false;
      trackDragging = false;
    };

    sliderHandle.on('pointerdown', (event) => {
      handleDragging = true;
      event.stopPropagation();
    });

    sliderTrack.eventMode = 'static';
    sliderTrack.cursor = 'pointer';
    sliderTrack.on('pointerdown', (event) => {
      updateSlider(event.global.x);
      trackDragging = true;
      event.stopPropagation();
    });

    // Add global pointer events to window
    this.app.stage.eventMode = 'static';
    this.app.stage.on('globalpointermove', onPointerMove);
    this.app.stage.on('pointerup', onPointerUp);
    this.app.stage.on('pointerupoutside', onPointerUp);

    this.timeControlsContainer.addChild(sliderHandle);

    // Range toggle button
    const buttonHeight = 30;
    const toggleY = 110;
    const toggleWidth = 150;
    const toggleButton = new Graphics();
    toggleButton.rect(0, 0, toggleWidth, buttonHeight);
    toggleButton.fill({ color: this.showAllRanges ? 0x4a9eff : 0x2a3a4a });
    toggleButton.stroke({ width: 1, color: this.showAllRanges ? 0x6a9eff : 0x3a4a5a });

    const toggleText = new Text({
      text: this.showAllRanges ? 'Hide All Ranges' : 'Show All Ranges',
      style: new TextStyle({ fontSize: 11, fill: 0xffffff })
    });
    toggleText.anchor.set(0.5);
    toggleText.position.set(toggleWidth / 2, buttonHeight / 2);

    toggleButton.addChild(toggleText);
    toggleButton.position.set(10, toggleY);
    toggleButton.eventMode = 'static';
    toggleButton.cursor = 'pointer';
    toggleButton.name = 'rangeToggle';

    toggleButton.on('pointerdown', () => this.toggleRanges());
    toggleButton.on('pointerover', () => {
      toggleButton.clear();
      toggleButton.rect(0, 0, toggleWidth, buttonHeight);
      toggleButton.fill({ color: this.showAllRanges ? 0x5a9eff : 0x3a4a5a });
      toggleButton.stroke({ width: 1, color: this.showAllRanges ? 0x7a9eff : 0x4a5a6a });
    });
    toggleButton.on('pointerout', () => {
      toggleButton.clear();
      toggleButton.rect(0, 0, toggleWidth, buttonHeight);
      toggleButton.fill({ color: this.showAllRanges ? 0x4a9eff : 0x2a3a4a });
      toggleButton.stroke({ width: 1, color: this.showAllRanges ? 0x6a9eff : 0x3a4a5a });
    });

    this.timeControlsContainer.addChild(toggleButton);

    // Fog of War toggle button (debug)
    const fogToggleY = 145;
    const fogToggleButton = new Graphics();
    fogToggleButton.rect(0, 0, toggleWidth, buttonHeight);
    fogToggleButton.fill({ color: this.fogOfWarEnabled ? 0x2a3a4a : 0xff6600 });
    fogToggleButton.stroke({ width: 1, color: this.fogOfWarEnabled ? 0x3a4a5a : 0xff7700 });

    const fogToggleText = new Text({
      text: this.fogOfWarEnabled ? 'Fog of War: ON' : 'Fog of War: OFF',
      style: new TextStyle({ fontSize: 11, fill: 0xffffff })
    });
    fogToggleText.anchor.set(0.5);
    fogToggleText.position.set(toggleWidth / 2, buttonHeight / 2);

    fogToggleButton.addChild(fogToggleText);
    fogToggleButton.position.set(10, fogToggleY);
    fogToggleButton.eventMode = 'static';
    fogToggleButton.cursor = 'pointer';
    fogToggleButton.name = 'fogToggle';

    fogToggleButton.on('pointerdown', () => this.toggleFogOfWar());
    fogToggleButton.on('pointerover', () => {
      fogToggleButton.clear();
      fogToggleButton.rect(0, 0, toggleWidth, buttonHeight);
      fogToggleButton.fill({ color: this.fogOfWarEnabled ? 0x3a4a5a : 0xff7700 });
      fogToggleButton.stroke({ width: 1, color: this.fogOfWarEnabled ? 0x4a5a6a : 0xff8800 });
    });
    fogToggleButton.on('pointerout', () => {
      fogToggleButton.clear();
      fogToggleButton.rect(0, 0, toggleWidth, buttonHeight);
      fogToggleButton.fill({ color: this.fogOfWarEnabled ? 0x2a3a4a : 0xff6600 });
      fogToggleButton.stroke({ width: 1, color: this.fogOfWarEnabled ? 0x3a4a5a : 0xff7700 });
    });

    this.timeControlsContainer.addChild(fogToggleButton);

    // Reset Camera button
    const resetY = 180;
    const resetButton = new Graphics();
    resetButton.rect(0, 0, toggleWidth, buttonHeight);
    resetButton.fill({ color: 0x2a3a4a });
    resetButton.stroke({ width: 1, color: 0x3a4a5a });

    const resetText = new Text({
      text: 'Reset Camera',
      style: new TextStyle({ fontSize: 11, fill: 0xffffff })
    });
    resetText.anchor.set(0.5);
    resetText.position.set(toggleWidth / 2, buttonHeight / 2);

    resetButton.addChild(resetText);
    resetButton.position.set(10, resetY);
    resetButton.eventMode = 'static';
    resetButton.cursor = 'pointer';
    resetButton.name = 'resetCamera';

    resetButton.on('pointerdown', () => this.resetCamera());
    resetButton.on('pointerover', () => {
      resetButton.clear();
      resetButton.rect(0, 0, toggleWidth, buttonHeight);
      resetButton.fill({ color: 0x3a4a5a });
      resetButton.stroke({ width: 1, color: 0x4a5a6a });
    });
    resetButton.on('pointerout', () => {
      resetButton.clear();
      resetButton.rect(0, 0, toggleWidth, buttonHeight);
      resetButton.fill({ color: 0x2a3a4a });
      resetButton.stroke({ width: 1, color: 0x3a4a5a });
    });

    this.timeControlsContainer.addChild(resetButton);
  }

  private drawEventLog() {
    // Title
    const titleStyle = new TextStyle({ fontSize: 14, fill: TEXT_COLOR, fontWeight: 'bold' });
    const title = new Text({ text: 'Battle Log', style: titleStyle });
    title.position.set(10, 0);
    this.eventLogContainer.addChild(title);

    // Log background
    const logBg = new Graphics();
    logBg.rect(5, 25, RIGHT_PANEL_WIDTH - 10, SCREEN_HEIGHT - 400);
    logBg.fill({ color: 0x0a0a0a, alpha: 0.5 });
    logBg.stroke({ width: 1, color: PANEL_BORDER });
    this.eventLogContainer.addChild(logBg);

    // Clear button
    const clearBtn = new Graphics();
    clearBtn.rect(0, 0, 50, 20);
    clearBtn.fill({ color: 0x2a3a4a });
    clearBtn.stroke({ width: 1, color: 0x3a4a5a });
    clearBtn.position.set(RIGHT_PANEL_WIDTH - 60, 0);
    clearBtn.eventMode = 'static';
    clearBtn.cursor = 'pointer';
    clearBtn.on('pointerdown', () => {
      this.currentEvents = [];
      this.updateEventLog();
    });

    const clearText = new Text({
      text: 'Clear',
      style: new TextStyle({ fontSize: 10, fill: 0xffffff })
    });
    clearText.anchor.set(0.5);
    clearText.position.set(25, 10);
    clearBtn.addChild(clearText);
    this.eventLogContainer.addChild(clearBtn);
  }

  private setGameSpeed(speed: number) {
    this.currentSpeed = speed;
    this.gameLoop.setTimeCompression(speed);
    console.log('[PixiGame] Speed set to', speed);

    // Update speed display text
    const speedDisplay = this.timeControlsContainer.getChildByName('speedDisplay') as Text;
    if (speedDisplay) {
      speedDisplay.text = `Speed: ${speed}x`;
    }

    // Update slider handle position
    const sliderHandle = this.timeControlsContainer.getChildByName('speedSliderHandle');
    if (sliderHandle) {
      const sliderX = 10;
      const sliderWidth = 350;
      const maxSpeed = 100;
      const sliderY = 75;
      const newHandleX = sliderX + (speed / maxSpeed) * sliderWidth;
      sliderHandle.position.set(newHandleX, sliderY);
    }

    this.updateRightPanel();
  }

  private toggleRanges() {
    this.showAllRanges = !this.showAllRanges;
    console.log('[PixiGame] Show all ranges:', this.showAllRanges);

    // Redraw time controls to update button state
    this.timeControlsContainer.removeChildren();
    this.drawTimeControls();
    this.updateRightPanel();
    // Note: render() called by Pixi ticker
  }

  private toggleFogOfWar() {
    this.fogOfWarEnabled = !this.fogOfWarEnabled;
    console.log('[PixiGame] Fog of war:', this.fogOfWarEnabled);

    // Redraw time controls to update button state
    this.timeControlsContainer.removeChildren();
    this.drawTimeControls();
    this.updateRightPanel();
    // Note: render() called by Pixi ticker
  }

  private resetCamera() {
    this.zoom = 1.0;
    this.panX = BATTLEFIELD_WIDTH / 2;
    this.panY = BATTLEFIELD_HEIGHT / 2;
    this.updateCamera();

    // Update zoom display
    const zoomDisplay = this.timeControlsContainer.getChildByName('zoomDisplay') as Text;
    if (zoomDisplay) {
      zoomDisplay.text = `Zoom: ${this.zoom.toFixed(1)}x`;
    }

    console.log('[Camera] Reset to default view');
  }

  private drawPanel(container: Container, width: number, height: number, title: string) {
    // Background
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill({ color: PANEL_BG });
    bg.rect(0, 0, width, height);
    bg.stroke({ width: 2, color: PANEL_BORDER });
    container.addChild(bg);

    // Title
    const titleStyle = new TextStyle({
      fontSize: 18,
      fill: TEXT_COLOR,
      fontWeight: 'bold',
    });
    const titleText = new Text({ text: title, style: titleStyle });
    titleText.position.set(10, 10);
    container.addChild(titleText);
  }

  private drawBattlefield() {
    // Background (stays in battlefield, not viewport)
    const bg = new Graphics();
    bg.rect(0, 0, BATTLEFIELD_WIDTH, BATTLEFIELD_HEIGHT);
    bg.fill({ color: 0x0a0a0a });
    this.battlefield.addChild(bg);

    // Create mask to prevent rendering outside battlefield bounds
    const mask = new Graphics();
    mask.rect(0, 0, BATTLEFIELD_WIDTH, BATTLEFIELD_HEIGHT);
    mask.fill({ color: 0xffffff });
    this.battlefield.addChild(mask);
    this.battlefield.mask = mask;

    // Create viewport container for all zoomable/pannable content
    this.viewport = new Container();
    this.battlefield.addChild(this.viewport);

    // Center viewport initially
    this.panX = BATTLEFIELD_WIDTH / 2;
    this.panY = BATTLEFIELD_HEIGHT / 2;
    this.viewport.position.set(this.panX, this.panY);

    // Grid (10km = 10,000m scaled to fit)
    const GRID_SIZE = 1000; // 1km
    const SCALE = BATTLEFIELD_WIDTH / 10000; // meters to pixels

    this.battlefieldGrid = new Graphics();
    for (let i = 0; i <= 10000; i += GRID_SIZE) {
      const pos = i * SCALE;
      this.battlefieldGrid.moveTo(pos, 0);
      this.battlefieldGrid.lineTo(pos, BATTLEFIELD_HEIGHT);
      this.battlefieldGrid.moveTo(0, pos);
      this.battlefieldGrid.lineTo(BATTLEFIELD_WIDTH, pos);
    }
    this.battlefieldGrid.stroke({ width: 1, color: 0x333333, alpha: 0.2 });

    // Border
    this.battlefieldGrid.rect(0, 0, BATTLEFIELD_WIDTH, BATTLEFIELD_HEIGHT);
    this.battlefieldGrid.stroke({ width: 2, color: PANEL_BORDER });

    // Add grid to viewport (so it zooms/pans)
    this.viewport.addChild(this.battlefieldGrid);

    // Grid labels
    this.gridLabels = [];
    for (let i = 0; i <= 10; i++) {
      const pos = i * (BATTLEFIELD_WIDTH / 10);
      const style = new TextStyle({ fontSize: 10, fill: TEXT_SECONDARY });
      const text = new Text({ text: `${i}km`, style });
      text.position.set(pos + 2, 2);
      this.gridLabels.push(text);
      // Add labels to viewport (so they zoom/pan with grid)
      this.viewport.addChild(text);
    }

    // Create scale bar (stays in battlefield, not viewport - so it doesn't zoom)
    this.scaleBar = new Container();
    this.scaleBar.position.set(20, BATTLEFIELD_HEIGHT - 40);
    this.battlefield.addChild(this.scaleBar);
    this.updateScaleBar();

    // Offset viewport content to center the map (0,0 in world = center of viewport)
    // World coordinates go from -5000 to +5000 (10km map)
    // Viewport pivot should be at world center
    this.viewport.pivot.set(BATTLEFIELD_WIDTH / 2, BATTLEFIELD_HEIGHT / 2);

    // Make battlefield interactive
    this.battlefield.eventMode = 'static';
    // Hit area handled by bg graphics

    // Mouse wheel zoom
    this.battlefield.on('wheel', (event: any) => {
      event.preventDefault();

      const delta = -event.deltaY; // Positive = zoom in
      const zoomFactor = 1 + delta * 0.001;
      const newZoom = this.zoom * zoomFactor;

      // Clamp zoom
      this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));

      // Zoom towards mouse cursor (important UX!)
      const mouseX = event.clientX - this.battlefield.x;
      const mouseY = event.clientY - this.battlefield.y;

      // Adjust pan to keep mouse point stationary
      const zoomRatio = this.zoom / (newZoom / zoomFactor);
      this.panX = (this.panX - mouseX) * zoomRatio + mouseX;
      this.panY = (this.panY - mouseY) * zoomRatio + mouseY;

      this.updateCamera();
      console.log('[Camera] Zoom:', this.zoom.toFixed(2));
    });

    this.battlefield.on('pointerdown', (event) => {
      // Middle mouse or Ctrl+Left for panning
      if (event.button === 1 || (event.button === 0 && event.ctrlKey)) {
        this.isPanning = true;
        this.panStart = {
          x: event.clientX - this.panX,
          y: event.clientY - this.panY
        };
        return;
      }

      if (event.button === 0 && !event.ctrlKey) {
        // Left click - start box selection
        const localPos = event.getLocalPosition(this.viewport);
        this.isBoxSelecting = true;
        this.boxSelectStart = { x: localPos.x, y: localPos.y };

        // Create selection box graphics
        this.selectionBox = new Graphics();
        this.viewport.addChild(this.selectionBox);
      } else if (event.button === 2) {
        // Right click - move order for all selected units
        const selectedIds = this.selectedUnitIds.size > 0
          ? Array.from(this.selectedUnitIds)
          : (this.selectedUnitId ? [this.selectedUnitId] : []);

        if (selectedIds.length > 0) {
          const localPos = event.getLocalPosition(this.battlefield);
          const SCALE = 10000 / BATTLEFIELD_WIDTH;
          const worldX = localPos.x * SCALE;
          const worldY = localPos.y * SCALE;

          const orders: Order[] = selectedIds.map(unitId => ({
            kind: 'move',
            unitId,
            targetPos: [worldX, worldY] as const,
          }));

          this.gameLoop.enqueueOrders(orders);
          console.log('[PixiGame] Move orders issued to', selectedIds.length, 'units, target:', [worldX, worldY]);
        }
      }
    });

    this.battlefield.on('pointermove', (event) => {
      // Handle panning
      if (this.isPanning && this.panStart) {
        this.panX = event.clientX - this.panStart.x;
        this.panY = event.clientY - this.panStart.y;
        this.updateCamera();
        return;
      }

      // Handle box selection
      if (this.isBoxSelecting && this.boxSelectStart && this.selectionBox) {
        const localPos = event.getLocalPosition(this.viewport);
        const x = Math.min(this.boxSelectStart.x, localPos.x);
        const y = Math.min(this.boxSelectStart.y, localPos.y);
        const width = Math.abs(localPos.x - this.boxSelectStart.x);
        const height = Math.abs(localPos.y - this.boxSelectStart.y);

        this.selectionBox.clear();
        this.selectionBox.rect(x, y, width, height);
        this.selectionBox.fill({ color: 0x4a9eff, alpha: 0.2 });
        this.selectionBox.stroke({ width: 2, color: 0x4a9eff });
      }
    });

    this.battlefield.on('pointerup', (event) => {
      // End panning
      if (event.button === 1 || (event.button === 0 && this.isPanning)) {
        this.isPanning = false;
        this.panStart = null;
        return;
      }

      if (event.button === 0 && this.isBoxSelecting && this.boxSelectStart) {
        const localPos = event.getLocalPosition(this.viewport);
        const SCALE = 10000 / BATTLEFIELD_WIDTH;

        // Calculate box bounds in world coordinates
        const boxX1 = Math.min(this.boxSelectStart.x, localPos.x) * SCALE;
        const boxY1 = Math.min(this.boxSelectStart.y, localPos.y) * SCALE;
        const boxX2 = Math.max(this.boxSelectStart.x, localPos.x) * SCALE;
        const boxY2 = Math.max(this.boxSelectStart.y, localPos.y) * SCALE;

        // Select units within box
        this.selectedUnitIds.clear();
        for (const unit of this.gameState.units.values()) {
          if (unit.side === 'BLUE' &&
              unit.pos[0] >= boxX1 && unit.pos[0] <= boxX2 &&
              unit.pos[1] >= boxY1 && unit.pos[1] <= boxY2) {
            this.selectedUnitIds.add(unit.id);
          }
        }

        // If box is too small (like a click), deselect all
        const boxWidth = Math.abs(localPos.x - this.boxSelectStart.x);
        const boxHeight = Math.abs(localPos.y - this.boxSelectStart.y);
        if (boxWidth < 5 && boxHeight < 5) {
          this.selectedUnitIds.clear();
          this.selectedUnitId = null;
        } else if (this.selectedUnitIds.size > 0) {
          // Update single selection to first unit in set
          this.selectedUnitId = Array.from(this.selectedUnitIds)[0];
        }

        // Clear selection box
        if (this.selectionBox) {
          this.viewport.removeChild(this.selectionBox);
          this.selectionBox = null;
        }
        this.isBoxSelecting = false;
        this.boxSelectStart = null;

        console.log('[PixiGame] Selected', this.selectedUnitIds.size, 'units');
        // Note: render() called by Pixi ticker
      }
    });

    console.log('[PixiGame] Battlefield drawn');
  }

  private updateCamera() {
    // Apply zoom and pan to viewport
    this.viewport.scale.set(this.zoom, this.zoom);
    this.viewport.position.set(this.panX, this.panY);

    // Update zoom display in UI
    const zoomDisplay = this.timeControlsContainer.getChildByName('zoomDisplay') as Text;
    if (zoomDisplay) {
      zoomDisplay.text = `Zoom: ${this.zoom.toFixed(1)}x`;
    }

    // Update scale bar based on zoom level
    this.updateScaleBar();
  }

  private updateScaleBar() {
    // Clear previous scale bar content
    this.scaleBar.removeChildren();

    // Calculate appropriate scale distance based on zoom level
    // At zoom 1.0, battlefield width (800px) = 10,000m
    // Visible width in meters = 10000 / zoom
    const visibleWidthM = 10000 / this.zoom;

    // Choose a nice round number for the scale bar (roughly 20% of visible width)
    const targetScaleM = visibleWidthM * 0.2;

    // Round to nice values: 50, 100, 200, 500, 1000, 2000, 5000, etc.
    let scaleDistanceM: number;
    if (targetScaleM >= 5000) {
      scaleDistanceM = Math.round(targetScaleM / 1000) * 1000;
    } else if (targetScaleM >= 1000) {
      scaleDistanceM = Math.round(targetScaleM / 500) * 500;
    } else if (targetScaleM >= 200) {
      scaleDistanceM = Math.round(targetScaleM / 100) * 100;
    } else if (targetScaleM >= 100) {
      scaleDistanceM = Math.round(targetScaleM / 50) * 50;
    } else {
      scaleDistanceM = Math.round(targetScaleM / 10) * 10;
    }

    // Calculate pixel width for this distance
    const SCALE = BATTLEFIELD_WIDTH / 10000; // pixels per meter
    const barWidthPx = scaleDistanceM * SCALE * this.zoom;

    // Format label text
    let labelText: string;
    if (scaleDistanceM >= 1000) {
      labelText = `${scaleDistanceM / 1000} km`;
    } else {
      labelText = `${scaleDistanceM} m`;
    }

    // Draw the scale bar (Google Maps style)
    const bar = new Graphics();

    // White background for visibility
    bar.rect(-2, -2, barWidthPx + 4, 12);
    bar.fill({ color: 0xffffff, alpha: 0.8 });

    // Black border
    bar.rect(0, 0, barWidthPx, 8);
    bar.stroke({ width: 2, color: 0x000000 });

    // Tick marks at ends
    bar.moveTo(0, 0);
    bar.lineTo(0, 8);
    bar.moveTo(barWidthPx, 0);
    bar.lineTo(barWidthPx, 8);
    bar.stroke({ width: 2, color: 0x000000 });

    this.scaleBar.addChild(bar);

    // Label
    const labelStyle = new TextStyle({
      fontSize: 14,
      fill: 0xffffff,
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 3 },
    });
    const label = new Text({ text: labelText, style: labelStyle });
    label.position.set(barWidthPx + 8, -2); // Position to the right of the bar
    this.scaleBar.addChild(label);
  }

  private onStateUpdate(state: GameState) {
    // Store previous positions for interpolation
    for (const unit of this.gameState.units.values()) {
      this.previousUnitPositions.set(unit.id, unit.pos);
    }

    // Update state and timestamp
    this.gameState = state;
    this.lastEngineUpdateTime = performance.now();

    // Note: render() is now called by Pixi ticker, not here
  }

  private onEvents(events: GameEvent[]) {
    // Add new events to the log (keep last 50)
    this.currentEvents.push(...events);
    if (this.currentEvents.length > 50) {
      this.currentEvents = this.currentEvents.slice(-50);
    }

    // Create projectiles for ShotFired events and handle Impact events
    for (const event of events) {
      if (event.kind === 'ShotFired') {
        this.createProjectile(event);
      } else if (event.kind === 'Impact') {
        this.createImpact(event);
      }
    }

    if (events.length > 0) {
      this.updateEventLog();
    }
  }

  private createProjectile(event: GameEvent) {
    const shooter = this.gameState.units.get(event.data.shooter);

    if (!shooter) {
      return;
    }

    // Store impact position to be set by the Impact event
    // For now, use target position as placeholder (will be updated when Impact event arrives)
    const target = this.gameState.units.get(event.data.target);
    if (!target) {
      return;
    }

    // Projectile speeds based on weapon type (meters per second)
    let speed: number;
    let color: number;

    switch (event.data.weapon) {
      case WeaponType.DIRECT_FIRE: // Tank shells
        speed = 1700; // ~1700 m/s for modern APFSDS
        color = 0xffaa00; // Orange
        break;
      case WeaponType.INDIRECT_FIRE: // Artillery
        speed = 400; // ~400 m/s average for artillery arc
        color = 0xff0000; // Red
        break;
      case WeaponType.ANTI_TANK: // AT missiles
        speed = 300; // ~300 m/s for missiles
        color = 0xffff00; // Yellow
        break;
      case WeaponType.SMALL_ARMS:
        speed = 900; // ~900 m/s for rifle rounds
        color = 0xaaaaaa; // Gray
        break;
      default:
        speed = 500;
        color = 0xffffff;
    }

    const projectile: Projectile = {
      fromX: shooter.pos[0],
      fromY: shooter.pos[1],
      toX: target.pos[0], // Temporary - will be overridden by Impact event
      toY: target.pos[1], // Temporary - will be overridden by Impact event
      currentX: shooter.pos[0],
      currentY: shooter.pos[1],
      speed,
      weaponType: event.data.weapon,
      startTime: this.gameState.tsMs,
      color,
    };

    this.projectiles.push(projectile);
  }

  private createImpact(event: GameEvent) {
    const impactPos = event.data.pos as readonly [number, number];

    // Update the most recent projectile's target to the actual impact position
    // Store impact data so we can create effects when projectile lands
    if (this.projectiles.length > 0) {
      const lastProjectile = this.projectiles[this.projectiles.length - 1];
      lastProjectile.toX = impactPos[0];
      lastProjectile.toY = impactPos[1];
      lastProjectile.impactData = {
        aoeRadius: event.data.aoeDamageRadius || 0,
        missDistance: event.data.missDistance || 0,
      };
    }
  }

  private isUnitVisible(unit: Unit): boolean {
    // Always show BLUE units (player's units)
    if (unit.side === 'BLUE') {
      return true;
    }

    // If fog of war is disabled, show all units
    if (!this.fogOfWarEnabled) {
      return true;
    }

    // RED units are only visible if spotted by at least one BLUE unit
    return unit.spottedBy.size > 0;
  }

  private getInterpolatedPosition(unit: Unit): readonly [number, number] {
    // Calculate interpolation alpha based on time since last engine update
    const now = performance.now();
    const timeSinceUpdate = now - this.lastEngineUpdateTime;
    const alpha = timeSinceUpdate / this.tickIntervalMs;

    // Get previous position (or current if no previous)
    const prevPos = this.previousUnitPositions.get(unit.id);

    // If no previous position, just return current (first frame)
    if (!prevPos) {
      return unit.pos;
    }

    // Interpolate between previous and current
    const interpX = lerp(prevPos[0], unit.pos[0], alpha);
    const interpY = lerp(prevPos[1], unit.pos[1], alpha);

    // Debug logging for first unit only
    if (unit.id === 'B-RECON-1' && Math.random() < 0.01) {
      console.log('[Interp]', {
        alpha: alpha.toFixed(2),
        prevPos,
        currentPos: unit.pos,
        interpPos: [interpX, interpY]
      });
    }

    return [interpX, interpY] as const;
  }

  private updateProjectiles() {
    const currentTime = this.gameState.tsMs;

    // Update projectile positions
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      const elapsed = (currentTime - proj.startTime) / 1000; // seconds

      // Calculate total distance and travel distance
      const dx = proj.toX - proj.fromX;
      const dy = proj.toY - proj.fromY;
      const totalDist = Math.sqrt(dx * dx + dy * dy);
      const travelDist = proj.speed * elapsed;

      if (travelDist >= totalDist) {
        // Projectile reached target - create impact effects NOW
        if (proj.impactData) {
          // Create explosion effect
          const explosion: Explosion = {
            x: proj.toX,
            y: proj.toY,
            startTime: currentTime,
            duration: proj.impactData.aoeRadius > 0 ? 800 : 200,
            maxRadius: proj.impactData.aoeRadius > 0 ? proj.impactData.aoeRadius : 5,
            weapon: proj.weaponType,
          };
          this.explosions.push(explosion);

          // Create impact crater
          const crater: ImpactEffect = {
            x: proj.toX,
            y: proj.toY,
            createdTime: currentTime,
            weapon: proj.weaponType,
            aoeRadius: proj.impactData.aoeRadius,
            missDistance: proj.impactData.missDistance,
          };
          this.impactCraters.push(crater);

          // Limit crater count
          if (this.impactCraters.length > 100) {
            this.impactCraters.shift();
          }
        }

        // Remove projectile
        this.projectiles.splice(i, 1);
      } else {
        // Update position
        const progress = travelDist / totalDist;
        proj.currentX = proj.fromX + dx * progress;
        proj.currentY = proj.fromY + dy * progress;
      }
    }
  }

  private render() {
    // Update projectiles
    this.updateProjectiles();

    // Clear previous units from viewport (keep grid/labels and selection box)
    // Grid and labels are first children, selection box might be present
    // Remove from end to beginning to avoid index shifting issues
    for (let i = this.viewport.children.length - 1; i >= 0; i--) {
      const child = this.viewport.children[i];
      // Keep grid, labels, and selection box
      if (child !== this.selectionBox &&
          child !== this.battlefieldGrid &&
          !this.gridLabels.includes(child as Text)) {
        this.viewport.removeChildAt(i);
      }
    }

    const SCALE = BATTLEFIELD_WIDTH / 10000;

    // Draw range circles (behind everything)
    for (const unit of this.gameState.units.values()) {
      // Show ranges if: selected OR showAllRanges toggle is on (and unit is BLUE)
      const shouldShowRange = this.selectedUnitIds.has(unit.id) ||
                              (this.showAllRanges && unit.side === 'BLUE');

      if (shouldShowRange) {
        const unitType = getUnitType(unit);
        // Use interpolated position for smooth range circles
        const interpPos = this.getInterpolatedPosition(unit);
        const canvasX = interpPos[0] * SCALE;
        const canvasY = interpPos[1] * SCALE;

        // Visual range (sensor range) - green circle
        const sensorRadiusPixels = unitType.sensorRangeM * SCALE;
        const sensorCircle = new Graphics();
        sensorCircle.circle(canvasX, canvasY, sensorRadiusPixels);
        sensorCircle.stroke({ width: 2, color: 0x00ff00, alpha: 0.3 });
        sensorCircle.fill({ color: 0x00ff00, alpha: 0.05 });
        this.viewport.addChild(sensorCircle);

        // Weapon range (engagement range) - red circle
        const weaponRadiusPixels = unitType.weaponRangeM * SCALE;
        const weaponCircle = new Graphics();
        weaponCircle.circle(canvasX, canvasY, weaponRadiusPixels);
        weaponCircle.stroke({ width: 2, color: 0xff0000, alpha: 0.3 });
        weaponCircle.fill({ color: 0xff0000, alpha: 0.05 });
        this.viewport.addChild(weaponCircle);
      }
    }

    // Draw movement indicators (above range circles, behind units)
    for (const unit of this.gameState.units.values()) {
      if (unit.intentTargetPos && this.selectedUnitIds.has(unit.id)) {
        // Use interpolated position for smooth line updates
        const interpPos = this.getInterpolatedPosition(unit);
        const fromX = interpPos[0] * SCALE;
        const fromY = interpPos[1] * SCALE;
        const toX = unit.intentTargetPos[0] * SCALE;
        const toY = unit.intentTargetPos[1] * SCALE;

        // Draw line from unit to destination
        const line = new Graphics();
        line.moveTo(fromX, fromY);
        line.lineTo(toX, toY);
        line.stroke({ width: 2, color: 0xffff00, alpha: 0.6 });
        this.viewport.addChild(line);

        // Draw X marker at destination
        const markerSize = 10;
        const marker = new Graphics();
        marker.moveTo(toX - markerSize, toY - markerSize);
        marker.lineTo(toX + markerSize, toY + markerSize);
        marker.moveTo(toX + markerSize, toY - markerSize);
        marker.lineTo(toX - markerSize, toY + markerSize);
        marker.stroke({ width: 3, color: 0xffff00 });
        this.viewport.addChild(marker);
      }
    }

    // Draw impact craters (behind units, with decay)
    const currentTime = this.gameState.tsMs;
    const CRATER_LIFETIME_MS = 30000; // 30 seconds before fully faded

    for (let i = this.impactCraters.length - 1; i >= 0; i--) {
      const crater = this.impactCraters[i];
      const age = currentTime - crater.createdTime;

      // Remove old craters
      if (age > CRATER_LIFETIME_MS) {
        this.impactCraters.splice(i, 1);
        continue;
      }

      const canvasX = crater.x * SCALE;
      const canvasY = crater.y * SCALE;

      // Fade out over time
      const alpha = 1.0 - (age / CRATER_LIFETIME_MS);

      const craterGraphic = new Graphics();

      // Draw crater based on weapon type
      if (crater.aoeRadius > 0) {
        // AOE weapon - show blast circle at actual damage radius
        const visualRadius = crater.aoeRadius * SCALE;
        craterGraphic.circle(canvasX, canvasY, visualRadius);
        craterGraphic.fill({ color: 0x333333, alpha: alpha * 0.3 });
        // Outer ring to show edge of damage radius
        craterGraphic.circle(canvasX, canvasY, visualRadius);
        craterGraphic.stroke({ width: 2, color: 0x666666, alpha: alpha * 0.4 });
      } else {
        // Direct fire - small impact mark
        craterGraphic.circle(canvasX, canvasY, 2);
        craterGraphic.fill({ color: 0x444444, alpha: alpha * 0.6 });
      }

      this.viewport.addChild(craterGraphic);
    }

    // Draw explosions (animated, on top of craters)
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const explosion = this.explosions[i];
      const age = currentTime - explosion.startTime;

      // Remove finished explosions
      if (age > explosion.duration) {
        this.explosions.splice(i, 1);
        continue;
      }

      const canvasX = explosion.x * SCALE;
      const canvasY = explosion.y * SCALE;

      // Animation progress (0 to 1)
      const progress = age / explosion.duration;

      // Expand then fade
      const currentRadius = explosion.maxRadius * SCALE * progress;
      const alpha = 1.0 - progress; // Fade out linearly

      const explosionGraphic = new Graphics();

      // Bright flash at start
      if (progress < 0.3) {
        const flashAlpha = (1.0 - progress / 0.3) * 0.8;
        explosionGraphic.circle(canvasX, canvasY, currentRadius * 0.5);
        explosionGraphic.fill({ color: 0xffff00, alpha: flashAlpha });
      }

      // Main explosion ring
      explosionGraphic.circle(canvasX, canvasY, currentRadius);
      const explosionColor = explosion.weapon === WeaponType.INDIRECT_FIRE ? 0xff4400 : 0xff8800;
      explosionGraphic.fill({ color: explosionColor, alpha: alpha * 0.6 });

      // Outer ring
      explosionGraphic.circle(canvasX, canvasY, currentRadius * 1.3);
      explosionGraphic.stroke({ width: 2, color: 0xff0000, alpha: alpha * 0.4 });

      this.viewport.addChild(explosionGraphic);
    }

    // Draw units (only visible ones)
    for (const unit of this.gameState.units.values()) {
      // Skip units hidden by fog of war
      if (!this.isUnitVisible(unit)) {
        continue;
      }

      // Use interpolated position for smooth movement
      const interpPos = this.getInterpolatedPosition(unit);
      const canvasX = interpPos[0] * SCALE;
      const canvasY = interpPos[1] * SCALE;
      const color = unit.side === 'BLUE' ? 0x4a9eff : 0xff4444;
      const isSelected = this.selectedUnitIds.has(unit.id);

      const unitContainer = new Container();
      unitContainer.position.set(canvasX, canvasY);

      // NATO symbol
      const symbol = new Graphics();
      this.drawUnitSymbol(symbol, unit.unitTypeId, color, 10);
      unitContainer.addChild(symbol);

      // Selection highlight
      if (isSelected) {
        const highlight = new Graphics();
        highlight.circle(0, 0, 18);
        highlight.stroke({ width: 2, color: 0xffff00 });
        unitContainer.addChild(highlight);
      }

      // Health bar
      const unitType = getUnitType(unit);
      const hpPercent = unit.hp / unitType.maxHp;
      const barWidth = 24;
      const healthBar = new Graphics();
      healthBar.rect(-barWidth / 2, -18, barWidth, 3);
      healthBar.fill({ color: 0x333333 });
      healthBar.rect(-barWidth / 2, -18, barWidth * hpPercent, 3);
      const hpColor = hpPercent > 0.5 ? 0x00ff00 : hpPercent > 0.25 ? 0xffff00 : 0xff0000;
      healthBar.fill({ color: hpColor });
      unitContainer.addChild(healthBar);

      // Interactive
      unitContainer.eventMode = 'static';
      unitContainer.cursor = 'pointer';
      unitContainer.on('pointerdown', (event) => {
        if (event.button === 0) {
          event.stopPropagation();
          // Toggle selection with Ctrl/Shift, otherwise single select
          if (event.shiftKey || event.ctrlKey) {
            if (this.selectedUnitIds.has(unit.id)) {
              this.selectedUnitIds.delete(unit.id);
            } else {
              this.selectedUnitIds.add(unit.id);
            }
          } else {
            this.selectedUnitIds.clear();
            this.selectedUnitIds.add(unit.id);
          }
          this.selectedUnitId = unit.id;
          // Note: render() called by Pixi ticker
        }
      });

      this.viewport.addChild(unitContainer);
    }

    // Draw projectiles (on top of units)
    for (const proj of this.projectiles) {
      const canvasX = proj.currentX * SCALE;
      const canvasY = proj.currentY * SCALE;

      const projectileGraphic = new Graphics();

      // Different visual styles based on weapon type
      if (proj.weaponType === WeaponType.INDIRECT_FIRE) {
        // Artillery - larger visible projectile
        projectileGraphic.circle(0, 0, 4);
        projectileGraphic.fill({ color: proj.color });
        projectileGraphic.circle(0, 0, 6);
        projectileGraphic.stroke({ width: 2, color: proj.color, alpha: 0.5 });
      } else if (proj.weaponType === WeaponType.DIRECT_FIRE) {
        // Tank shell - fast streak
        projectileGraphic.circle(0, 0, 3);
        projectileGraphic.fill({ color: proj.color });
        // Add a trail
        const dx = proj.toX - proj.fromX;
        const dy = proj.toY - proj.fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const trailLength = 20; // meters
        const trailX = -(dx / dist) * trailLength * SCALE;
        const trailY = -(dy / dist) * trailLength * SCALE;
        projectileGraphic.moveTo(0, 0);
        projectileGraphic.lineTo(trailX, trailY);
        projectileGraphic.stroke({ width: 2, color: proj.color, alpha: 0.3 });
      } else if (proj.weaponType === WeaponType.ANTI_TANK) {
        // Missile - visible with trail
        projectileGraphic.circle(0, 0, 3);
        projectileGraphic.fill({ color: proj.color });
        // Rocket trail
        const dx = proj.toX - proj.fromX;
        const dy = proj.toY - proj.fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const trailLength = 15;
        const trailX = -(dx / dist) * trailLength * SCALE;
        const trailY = -(dy / dist) * trailLength * SCALE;
        projectileGraphic.moveTo(0, 0);
        projectileGraphic.lineTo(trailX, trailY);
        projectileGraphic.stroke({ width: 3, color: 0xff6600, alpha: 0.6 });
      } else {
        // Small arms - tiny dot
        projectileGraphic.circle(0, 0, 2);
        projectileGraphic.fill({ color: proj.color });
      }

      projectileGraphic.position.set(canvasX, canvasY);
      this.viewport.addChild(projectileGraphic);
    }

    // Update left panel - unit list
    this.updateUnitList();

    // Update right panel
    this.updateRightPanel();
  }

  private updateRightPanel() {
    // Update unit info section
    this.unitInfoContainer.removeChildren();

    if (this.selectedUnitIds.size > 1) {
      // Multiple units selected - show summary
      const style = new TextStyle({ fontSize: 12, fill: 0xffffff });
      const labelStyle = new TextStyle({ fontSize: 11, fill: TEXT_SECONDARY });

      let y = 10;

      const countText = new Text({ text: `${this.selectedUnitIds.size} units selected`, style });
      countText.position.set(10, y);
      this.unitInfoContainer.addChild(countText);
      y += 25;

      // Count by type
      const typeCounts = new Map<string, number>();
      for (const unitId of this.selectedUnitIds) {
        const unit = this.gameState.units.get(unitId);
        if (unit) {
          typeCounts.set(unit.unitTypeId, (typeCounts.get(unit.unitTypeId) || 0) + 1);
        }
      }

      for (const [type, count] of typeCounts) {
        const typeText = new Text({ text: `${type}: ${count}`, style: labelStyle });
        typeText.position.set(10, y);
        this.unitInfoContainer.addChild(typeText);
        y += 18;
      }

    } else if (this.selectedUnitId) {
      const unit = this.gameState.units.get(this.selectedUnitId);
      if (unit) {
        const style = new TextStyle({ fontSize: 12, fill: 0xffffff });
        const labelStyle = new TextStyle({ fontSize: 11, fill: TEXT_SECONDARY });

        let y = 10;

        // Unit ID and type
        const idText = new Text({ text: `${unit.id} - ${unit.unitTypeId}`, style });
        idText.position.set(10, y);
        this.unitInfoContainer.addChild(idText);
        y += 25;

        // HP bar
        const hpLabel = new Text({ text: 'Health:', style: labelStyle });
        hpLabel.position.set(10, y);
        this.unitInfoContainer.addChild(hpLabel);

        const hpPercent = unit.hp / 100;
        const barWidth = RIGHT_PANEL_WIDTH - 80;
        const hpBar = new Graphics();
        hpBar.rect(0, 0, barWidth, 12);
        hpBar.fill({ color: 0x333333 });
        hpBar.rect(0, 0, barWidth * hpPercent, 12);
        const hpColor = hpPercent > 0.5 ? 0x00ff00 : hpPercent > 0.25 ? 0xffff00 : 0xff0000;
        hpBar.fill({ color: hpColor });
        hpBar.position.set(70, y);
        this.unitInfoContainer.addChild(hpBar);

        const hpText = new Text({ text: `${unit.hp}/100`, style: labelStyle });
        hpText.position.set(80 + barWidth, y);
        this.unitInfoContainer.addChild(hpText);
        y += 25;

        // Ammo
        const ammoText = new Text({ text: `Ammo: ${unit.ammo}`, style: labelStyle });
        ammoText.position.set(10, y);
        this.unitInfoContainer.addChild(ammoText);
        y += 20;

        // Position
        const posX = (unit.pos[0] / 1000).toFixed(1);
        const posY = (unit.pos[1] / 1000).toFixed(1);
        const posText = new Text({ text: `Position: (${posX}, ${posY}) km`, style: labelStyle });
        posText.position.set(10, y);
        this.unitInfoContainer.addChild(posText);
        y += 20;

        // Status
        const status = unit.routed ? 'ROUTED' : unit.intentTargetPos ? 'Moving' : 'Idle';
        const statusText = new Text({ text: `Status: ${status}`, style: labelStyle });
        statusText.position.set(10, y);
        this.unitInfoContainer.addChild(statusText);
      }
    } else {
      const hintStyle = new TextStyle({ fontSize: 11, fill: TEXT_SECONDARY, fontStyle: 'italic' });
      const hint = new Text({ text: 'Select units or drag a box to select', style: hintStyle });
      hint.position.set(10, 10);
      this.unitInfoContainer.addChild(hint);
    }

    // Update time display
    const timeDisplay = this.timeControlsContainer.getChildByName('timeDisplay') as Text;
    if (timeDisplay) {
      const totalSeconds = this.gameState.tsMs / 1000;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = Math.floor(totalSeconds % 60);
      timeDisplay.text = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    const speedDisplay = this.timeControlsContainer.getChildByName('speedDisplay') as Text;
    if (speedDisplay) {
      speedDisplay.text = this.currentSpeed === 0 ? 'Speed: Paused' : `Speed: ${this.currentSpeed}x`;
    }
  }

  private updateEventLog() {
    // Remove old event texts (keep title, bg, and clear button)
    while (this.eventLogContainer.children.length > 3) {
      this.eventLogContainer.removeChildAt(3);
    }

    let y = 30;
    const maxEvents = Math.min(this.currentEvents.length, 25); // Show last 25 events

    for (let i = this.currentEvents.length - maxEvents; i < this.currentEvents.length; i++) {
      const event = this.currentEvents[i];
      const eventText = this.formatEvent(event);

      const style = new TextStyle({
        fontSize: 10,
        fill: this.getEventColor(event.kind),
        wordWrap: true,
        wordWrapWidth: RIGHT_PANEL_WIDTH - 20
      });

      const text = new Text({ text: eventText, style });
      text.position.set(10, y);
      this.eventLogContainer.addChild(text);

      y += 18;
    }
  }

  private formatEvent(event: GameEvent): string {
    const time = (event.tsMs / 1000).toFixed(0);

    switch (event.kind) {
      case 'UnitFired':
        return `[${time}s] ${event.data.attacker_id} fired at ${event.data.target_id}`;
      case 'UnitHit':
        return `[${time}s] ${event.data.target_id} hit (${event.data.damage.toFixed(0)} dmg)`;
      case 'UnitDestroyed':
        return `[${time}s] ${event.data.unit_id} DESTROYED`;
      case 'UnitRouted':
        return `[${time}s] ${event.data.unit_id} ROUTED`;
      case 'OrderReceived':
        return `[${time}s] Order: ${event.data.unit_id} ${event.data.kind}`;
      default:
        return `[${time}s] ${event.kind}`;
    }
  }

  private getEventColor(kind: string): number {
    switch (kind) {
      case 'UnitFired':
      case 'UnitHit':
        return 0xff4444;
      case 'UnitDestroyed':
        return 0xff00ff;
      case 'UnitRouted':
        return 0xffff00;
      case 'OrderReceived':
        return 0x44ff44;
      default:
        return TEXT_SECONDARY;
    }
  }

  private drawUnitSymbol(graphics: Graphics, unitTypeId: string, color: number, size: number) {
    graphics.clear();
    switch (unitTypeId) {
      case 'RECON':
        graphics.poly([0, -size, size, 0, 0, size, -size, 0]);
        graphics.stroke({ width: 2.5, color });
        break;
      case 'INFANTRY':
        graphics.moveTo(-size * 0.7, -size * 0.7);
        graphics.lineTo(size * 0.7, size * 0.7);
        graphics.moveTo(size * 0.7, -size * 0.7);
        graphics.lineTo(-size * 0.7, size * 0.7);
        graphics.stroke({ width: 2.5, color });
        break;
      case 'MBT':
        graphics.rect(-size * 0.8, -size * 0.6, size * 1.6, size * 1.2);
        graphics.moveTo(-size * 0.8, 0);
        graphics.lineTo(size * 0.8, 0);
        graphics.stroke({ width: 2.5, color });
        break;
      case 'ARTILLERY':
        graphics.circle(0, 0, size * 0.8);
        graphics.stroke({ width: 2.5, color });
        graphics.circle(0, 0, size * 0.3);
        graphics.fill({ color });
        break;
    }
  }

  private updateUnitList() {
    // Clear previous list (keep bg and title)
    while (this.leftPanel.children.length > 2) {
      this.leftPanel.removeChildAt(2);
    }

    let y = 50;
    const blueUnits = Array.from(this.gameState.units.values()).filter(u => u.side === 'BLUE');

    for (const unit of blueUnits) {
      const isSelected = unit.id === this.selectedUnitId;
      const bg = new Graphics();
      bg.rect(5, y, LEFT_PANEL_WIDTH - 10, 40);
      bg.fill({ color: isSelected ? 0x2a4a6a : 0x1a2a3a });
      bg.stroke({ width: 1, color: isSelected ? 0x4a9eff : 0x2a3a4a });

      const style = new TextStyle({ fontSize: 12, fill: 0xffffff });
      const text = new Text({ text: `${unit.id} - ${unit.unitTypeId}`, style });
      text.position.set(15, y + 5);

      const hpText = new Text({ text: `HP: ${unit.hp}`, style: new TextStyle({ fontSize: 10, fill: 0xaaaaaa }) });
      hpText.position.set(15, y + 22);

      bg.eventMode = 'static';
      bg.cursor = 'pointer';
      bg.on('pointerdown', () => {
        this.selectedUnitId = unit.id;
        // Note: render() called by Pixi ticker
      });

      this.leftPanel.addChild(bg);
      this.leftPanel.addChild(text);
      this.leftPanel.addChild(hpText);

      y += 45;
    }
  }

  destroy() {
    this.gameLoop.stop();
    this.app.destroy(true);
  }
}
