import type { BattleState, UnitTypeId } from '../../types';

interface UnitPanelProps {
  state: BattleState | null;
  selectedUnitId: string | null;
  onUnitClick: (unitId: string) => void;
}

// Get friendly display name for unit type
function getUnitTypeName(unitTypeId: UnitTypeId): string {
  const names: Record<UnitTypeId, string> = {
    'RECON': 'Recon',
    'INFANTRY': 'Infantry',
    'MBT': 'MBT',
    'ARTILLERY': 'Artillery'
  };
  return names[unitTypeId];
}

export function UnitPanel({ state, selectedUnitId, onUnitClick }: UnitPanelProps) {
  if (!state) {
    return (
      <div className="unit-panel">
        <h3>Units</h3>
        <p className="no-data">No battle active</p>
      </div>
    );
  }

  const units = Object.values(state.units);
  const blueUnits = units.filter(u => u.side === 'BLUE');
  const redUnits = units.filter(u => u.side === 'RED');

  return (
    <div className="unit-panel">
      <h3>Units</h3>

      <div className="unit-section">
        <h4 className="side-header blue">BLUE Force ({blueUnits.length})</h4>
        {blueUnits.map(unit => (
          <div
            key={unit.id}
            className={`unit-card ${unit.id === selectedUnitId ? 'selected' : ''} ${unit.routed ? 'routed' : ''}`}
            onClick={() => onUnitClick(unit.id)}
          >
            <div className="unit-header">
              <span className="unit-id">{unit.id}</span>
              {unit.routed && <span className="routed-badge">ROUTED</span>}
            </div>
            <div className="unit-stats">
              <div className="stat">
                <span className="stat-label">Type:</span>
                <span className="stat-value">{getUnitTypeName(unit.unit_type_id)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">HP:</span>
                <div className="hp-bar-container">
                  <div
                    className="hp-bar"
                    style={{
                      width: `${Math.max(0, unit.hp)}%`,
                      backgroundColor: unit.hp > 50 ? '#4f4' : unit.hp > 25 ? '#ff4' : '#f44'
                    }}
                  />
                  <span className="hp-text">{Math.round(unit.hp)}</span>
                </div>
              </div>
              <div className="stat">
                <span className="stat-label">Ammo:</span>
                <span className="stat-value">{unit.ammo}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Pos:</span>
                <span className="stat-value">
                  ({(unit.pos[0] / 1000).toFixed(1)}, {(unit.pos[1] / 1000).toFixed(1)}) km
                </span>
              </div>
              {unit.target_id && (
                <div className="stat">
                  <span className="stat-label">Target:</span>
                  <span className="stat-value target">{unit.target_id}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="unit-section">
        <h4 className="side-header red">RED Force ({redUnits.length})</h4>
        {redUnits.map(unit => (
          <div
            key={unit.id}
            className={`unit-card ${unit.id === selectedUnitId ? 'selected' : ''} ${unit.routed ? 'routed' : ''}`}
            onClick={() => onUnitClick(unit.id)}
          >
            <div className="unit-header">
              <span className="unit-id">{unit.id}</span>
              {unit.routed && <span className="routed-badge">ROUTED</span>}
            </div>
            <div className="unit-stats">
              <div className="stat">
                <span className="stat-label">Type:</span>
                <span className="stat-value">{getUnitTypeName(unit.unit_type_id)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">HP:</span>
                <div className="hp-bar-container">
                  <div
                    className="hp-bar"
                    style={{
                      width: `${Math.max(0, unit.hp)}%`,
                      backgroundColor: unit.hp > 50 ? '#4f4' : unit.hp > 25 ? '#ff4' : '#f44'
                    }}
                  />
                  <span className="hp-text">{Math.round(unit.hp)}</span>
                </div>
              </div>
              <div className="stat">
                <span className="stat-label">Ammo:</span>
                <span className="stat-value">{unit.ammo}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Pos:</span>
                <span className="stat-value">
                  ({(unit.pos[0] / 1000).toFixed(1)}, {(unit.pos[1] / 1000).toFixed(1)}) km
                </span>
              </div>
              {unit.target_id && (
                <div className="stat">
                  <span className="stat-label">Target:</span>
                  <span className="stat-value target">{unit.target_id}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
