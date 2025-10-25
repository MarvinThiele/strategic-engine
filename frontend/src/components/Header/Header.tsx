import { useState } from 'react';
import type { BattleState } from '../../types';
import { useGameStore } from '../../store/gameStore';

interface HeaderProps {
  state: BattleState | null;
  onBattleStarted: () => void;
}

export function Header({ state, onBattleStarted }: HeaderProps) {
  const [seed, setSeed] = useState(String(Math.floor(Math.random() * 1000000)));
  const startBattle = useGameStore((s) => s.startBattle);

  const handleStartBattle = () => {
    const seedNum = parseInt(seed, 10);
    startBattle(seedNum);
    onBattleStarted();
  };

  const formatTime = (ts_ms: number): string => {
    const seconds = ts_ms / 1000; // Convert ms to seconds
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <h1>Strategic Combat Engine</h1>

        <div className="battle-controls">
          <div className="seed-input">
            <label>Seed:</label>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
          </div>

          <button
            className="btn-new-battle"
            onClick={handleStartBattle}
          >
            New Battle
          </button>

          {state && (
            <div className="battle-time">
              Time: <strong>{formatTime(state.ts_ms)}</strong>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
