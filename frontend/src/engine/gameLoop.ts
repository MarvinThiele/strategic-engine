/**
 * Game loop - runs the engine at a fixed tick rate
 * Replacement for Python TickRunner
 */

import { Engine } from './engine';
import type { GameEvent, GameState, Order } from './model';

export class GameLoop {
  private engine: Engine;
  private tickMs: number;
  private timeCompression: number;
  private running: boolean = false;
  private lastTickTime: number = 0;
  private accumulatedTime: number = 0;
  private animationFrameId: number | null = null;
  private onStateUpdate?: (state: GameState) => void;
  private onEvents?: (events: GameEvent[]) => void;

  constructor(
    engine: Engine,
    tickMs: number = 500,
    timeCompression: number = 30.0,
    onStateUpdate?: (state: GameState) => void,
    onEvents?: (events: GameEvent[]) => void
  ) {
    this.engine = engine;
    this.tickMs = tickMs;
    this.timeCompression = timeCompression;
    this.onStateUpdate = onStateUpdate;
    this.onEvents = onEvents;
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.lastTickTime = performance.now();
    this.accumulatedTime = 0;
    this.tick();
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Main tick function - called via requestAnimationFrame
   */
  private tick = (): void => {
    if (!this.running) {
      return;
    }

    const now = performance.now();
    const realDeltaMs = now - this.lastTickTime;
    this.lastTickTime = now;

    // Accumulate real time
    this.accumulatedTime += realDeltaMs;

    // Process ticks if enough time has accumulated
    while (this.accumulatedTime >= this.tickMs) {
      // Step the engine with compressed time
      const simDeltaMs = this.tickMs * this.timeCompression;
      const events = this.engine.step(simDeltaMs);

      // Notify listeners
      if (this.onEvents && events.length > 0) {
        this.onEvents(events);
      }

      if (this.onStateUpdate) {
        this.onStateUpdate(this.engine.snapshot());
      }

      this.accumulatedTime -= this.tickMs;
    }

    // Schedule next tick
    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  /**
   * Queue orders for the engine
   */
  enqueueOrders(orders: Order[]): void {
    this.engine.applyOrders(orders);
  }

  /**
   * Get current state snapshot
   */
  snapshot(): GameState {
    return this.engine.snapshot();
  }

  /**
   * Change time compression
   */
  setTimeCompression(compression: number): void {
    this.timeCompression = compression;
  }

  /**
   * Get current time compression
   */
  getTimeCompression(): number {
    return this.timeCompression;
  }

  /**
   * Change tick rate
   */
  setTickRate(tickMs: number): void {
    this.tickMs = tickMs;
  }
}
