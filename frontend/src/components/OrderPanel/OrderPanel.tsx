import { useState, useEffect } from 'react';
import type { BattleState, Order, Position } from '../../types';

interface OrderPanelProps {
  state: BattleState | null;
  selectedUnitId: string | null;
  onSubmitOrder: (order: Order) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
  clickedPosition: Position | null;
  onPositionUsed: () => void;
}

export function OrderPanel({
  state,
  selectedUnitId,
  onSubmitOrder,
  isSubmitting,
  error,
  clickedPosition,
  onPositionUsed,
}: OrderPanelProps) {
  const [orderType, setOrderType] = useState<'move' | 'attack'>('move');
  const [targetX, setTargetX] = useState('');
  const [targetY, setTargetY] = useState('');
  const [targetUnitId, setTargetUnitId] = useState('');

  // Reset inputs when selected unit changes
  useEffect(() => {
    setTargetX('');
    setTargetY('');
    setTargetUnitId('');
  }, [selectedUnitId]);

  // Auto-fill position when clicking on the map
  useEffect(() => {
    if (clickedPosition && selectedUnitId) {
      setOrderType('move');
      setTargetX((clickedPosition[0] / 1000).toFixed(1));
      setTargetY((clickedPosition[1] / 1000).toFixed(1));
      onPositionUsed();
    }
  }, [clickedPosition, selectedUnitId, onPositionUsed]);

  const selectedUnit = state && selectedUnitId ? state.units[selectedUnitId] : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUnitId) return;

    let order: Order;

    if (orderType === 'move') {
      const x = parseFloat(targetX);
      const y = parseFloat(targetY);

      if (isNaN(x) || isNaN(y)) {
        alert('Please enter valid coordinates');
        return;
      }

      const targetPos: Position = [x * 1000, y * 1000]; // Convert km to meters
      order = {
        kind: 'move',
        unit_id: selectedUnitId,
        target_pos: targetPos,
      };
    } else {
      if (!targetUnitId.trim()) {
        alert('Please enter a target unit ID');
        return;
      }

      order = {
        kind: 'attack',
        unit_id: selectedUnitId,
        target_unit_id: targetUnitId.trim(),
      };
    }

    const success = await onSubmitOrder(order);
    if (success) {
      setTargetX('');
      setTargetY('');
      setTargetUnitId('');
    }
  };

  if (!state) {
    return (
      <div className="order-panel">
        <h3>Orders</h3>
        <p className="no-data">No battle active</p>
      </div>
    );
  }

  if (!selectedUnitId) {
    return (
      <div className="order-panel">
        <h3>Orders</h3>
        <p className="instruction">Select a unit to issue orders</p>
      </div>
    );
  }

  if (!selectedUnit) {
    return (
      <div className="order-panel">
        <h3>Orders</h3>
        <p className="error">Selected unit not found</p>
      </div>
    );
  }

  return (
    <div className="order-panel">
      <h3>Orders</h3>

      <div className="selected-unit-info">
        <strong>Selected: {selectedUnit.id}</strong>
        <span className={`side-badge ${selectedUnit.side.toLowerCase()}`}>
          {selectedUnit.side}
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Order Type</label>
          <div className="button-group">
            <button
              type="button"
              className={`btn-toggle ${orderType === 'move' ? 'active' : ''}`}
              onClick={() => setOrderType('move')}
            >
              Move
            </button>
            <button
              type="button"
              className={`btn-toggle ${orderType === 'attack' ? 'active' : ''}`}
              onClick={() => setOrderType('attack')}
            >
              Attack
            </button>
          </div>
        </div>

        {orderType === 'move' ? (
          <>
            <div className="form-group">
              <label>Target Position (km)</label>
              <div className="coordinate-inputs">
                <input
                  type="number"
                  placeholder="X"
                  step="0.1"
                  min="0"
                  max="10"
                  value={targetX}
                  onChange={(e) => setTargetX(e.target.value)}
                  required
                />
                <input
                  type="number"
                  placeholder="Y"
                  step="0.1"
                  min="0"
                  max="10"
                  value={targetY}
                  onChange={(e) => setTargetY(e.target.value)}
                  required
                />
              </div>
              <p className="hint">Click on battlefield to set position</p>
            </div>
          </>
        ) : (
          <div className="form-group">
            <label>Target Unit ID</label>
            <input
              type="text"
              placeholder="e.g., R1"
              value={targetUnitId}
              onChange={(e) => setTargetUnitId(e.target.value)}
              required
            />
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <button
          type="submit"
          className="btn-submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Order'}
        </button>
      </form>
    </div>
  );
}
