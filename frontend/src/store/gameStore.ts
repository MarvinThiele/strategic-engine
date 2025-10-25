/**
 * Zustand store wrapping the game engine
 * Manages game state and provides actions to control the game
 */

import { create } from 'zustand';
import { Engine } from '../engine/engine';
import { GameLoop } from '../engine/gameLoop';
import type { GameState, GameEvent, Order } from '../engine/model';
import { createInitialState } from '../engine/model';

interface GameStore {
  // State
  state: GameState | null;
  events: GameEvent[];
  isRunning: boolean;
  selectedUnitId: string | null;

  // Engine internals (not exposed to components)
  _engine: Engine | null;
  _gameLoop: GameLoop | null;

  // Actions
  startBattle: (seed?: number) => void;
  stopBattle: () => void;
  issueOrders: (orders: Order[]) => void;
  selectUnit: (unitId: string | null) => void;
  clearEvents: () => void;
  setTimeCompression: (compression: number) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  state: null,
  events: [],
  isRunning: false,
  selectedUnitId: null,
  _engine: null,
  _gameLoop: null,

  // Start a new battle
  startBattle: (seed = 42) => {
    // Stop existing battle if any
    const existing = get()._gameLoop;
    if (existing) {
      existing.stop();
    }

    // Create new engine and game loop
    const initialState = createInitialState();
    const engine = new Engine(seed, initialState);

    const gameLoop = new GameLoop(
      engine,
      500, // tick every 500ms
      30.0, // 30x time compression
      // On state update
      (newState) => {
        set({ state: newState });
      },
      // On events
      (newEvents) => {
        set((state) => ({
          events: [...state.events, ...newEvents],
        }));
      }
    );

    gameLoop.start();

    set({
      _engine: engine,
      _gameLoop: gameLoop,
      state: initialState,
      isRunning: true,
      events: [],
      selectedUnitId: null,
    });
  },

  // Stop the current battle
  stopBattle: () => {
    const gameLoop = get()._gameLoop;
    if (gameLoop) {
      gameLoop.stop();
    }

    set({
      isRunning: false,
      _gameLoop: null,
      _engine: null,
    });
  },

  // Issue orders to units
  issueOrders: (orders) => {
    const gameLoop = get()._gameLoop;
    if (gameLoop) {
      gameLoop.enqueueOrders(orders);
    }
  },

  // Select a unit
  selectUnit: (unitId) => {
    set({ selectedUnitId: unitId });
  },

  // Clear event log
  clearEvents: () => {
    set({ events: [] });
  },

  // Change time compression
  setTimeCompression: (compression) => {
    const gameLoop = get()._gameLoop;
    if (gameLoop) {
      gameLoop.setTimeCompression(compression);
    }
  },
}));
