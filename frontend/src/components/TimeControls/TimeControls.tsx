import { useGameStore } from '../../store/gameStore';

const SPEED_OPTIONS = [
  { label: 'Pause', value: 0 },
  { label: '0.5x', value: 0.5 },
  { label: '1x', value: 1 },
  { label: '30x', value: 30 },
  { label: '100x', value: 100 },
];

export function TimeControls() {
  const setTimeCompression = useGameStore((s) => s.setTimeCompression);
  const currentSpeed = useGameStore((s) => s._gameLoop?.getTimeCompression() ?? 30);

  const handleSpeedChange = (speed: number) => {
    setTimeCompression(speed);
  };

  return (
    <div className="time-controls">
      <h3>Time Control</h3>
      <div className="speed-buttons">
        {SPEED_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            className={`btn-speed ${currentSpeed === value ? 'active' : ''}`}
            onClick={() => handleSpeedChange(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="current-speed">
        Current: <strong>{currentSpeed === 0 ? 'Paused' : `${currentSpeed}x`}</strong>
      </div>
    </div>
  );
}
