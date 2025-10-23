import { useState } from 'react';
import { useBattleState } from './hooks/useBattleState';
import { useSelection } from './hooks/useSelection';
import { useEventStream } from './hooks/useEventStream';
import { useOrders } from './hooks/useOrders';
import { Header } from './components/Header/Header';
import { BattlefieldCanvas } from './components/Battlefield/BattlefieldCanvas';
import { UnitPanel } from './components/UnitPanel/UnitPanel';
import { OrderPanel } from './components/OrderPanel/OrderPanel';
import { TimeControls } from './components/TimeControls/TimeControls';
import { EventLog } from './components/EventLog/EventLog';
import type { Position } from './types';

function App() {
  const { state, isLoading, error } = useBattleState();
  const { selectedUnitId, selectUnit, clearSelection } = useSelection();
  const { events, clearEvents } = useEventStream();
  const { submitOrder, isSubmitting, error: orderError } = useOrders();
  const [clickedPosition, setClickedPosition] = useState<Position | null>(null);

  const handleUnitClick = (unitId: string) => {
    selectUnit(unitId);
    setClickedPosition(null); // Clear clicked position when selecting a unit
  };

  const handleEmptyClick = (worldPos: Position) => {
    if (selectedUnitId) {
      // Auto-fill move order with clicked position
      setClickedPosition(worldPos);
    } else {
      clearSelection();
      setClickedPosition(null);
    }
  };

  const handleBattleStarted = () => {
    clearSelection();
    clearEvents();
  };

  if (error) {
    return (
      <div className="app-container">
        <Header state={null} onBattleStarted={handleBattleStarted} />
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <p>Make sure the backend server is running on port 8000</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header state={state} onBattleStarted={handleBattleStarted} />

      <main className="app-main">
        {isLoading ? (
          <div className="loading-container">
            <p>Loading battle state...</p>
          </div>
        ) : (
          <>
            <aside className="sidebar-left">
              <UnitPanel
                state={state}
                selectedUnitId={selectedUnitId}
                onUnitClick={handleUnitClick}
              />
            </aside>

            <div className="center-content">
              <BattlefieldCanvas
                state={state}
                selectedUnitId={selectedUnitId}
                onUnitClick={handleUnitClick}
                onEmptyClick={handleEmptyClick}
              />
            </div>

            <aside className="sidebar-right">
              <OrderPanel
                state={state}
                selectedUnitId={selectedUnitId}
                onSubmitOrder={submitOrder}
                isSubmitting={isSubmitting}
                error={orderError}
                clickedPosition={clickedPosition}
                onPositionUsed={() => setClickedPosition(null)}
              />
              <TimeControls />
              <EventLog events={events} onClear={clearEvents} />
            </aside>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
