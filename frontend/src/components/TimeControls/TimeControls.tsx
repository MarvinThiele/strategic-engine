import { useState } from 'react';
import { battleAPI } from '../../services/api';

const SPEED_OPTIONS = [
  { label: 'Pause', value: 0 },
  { label: '0.5x', value: 0.5 },
  { label: '1x', value: 1 },
  { label: '30x', value: 30 },
  { label: '100x', value: 100 },
];

export function TimeControls() {
  const [currentSpeed, setCurrentSpeed] = useState(30);
  const [isChanging, setIsChanging] = useState(false);

  const handleSpeedChange = async (speed: number) => {
    setIsChanging(true);
    try {
      await battleAPI.setTimeCompression(speed);
      setCurrentSpeed(speed);
    } catch (err) {
      console.error('Failed to set time compression:', err);
    } finally {
      setIsChanging(false);
    }
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
            disabled={isChanging}
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
