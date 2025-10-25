import { useState, useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { convertGameStateToBattleState } from './adapters/stateAdapter';
import { convertGameEventsToBattleEvents } from './adapters/eventAdapter';
import { convertComponentOrderToEngineOrder } from './adapters/orderAdapter';
import { Header } from './components/Header/Header';
import { PixiBattlefield } from './components/Battlefield/PixiBattlefieldSimple';
import { UnitPanel } from './components/UnitPanel/UnitPanel';
import { OrderPanel } from './components/OrderPanel/OrderPanel';
import { TimeControls } from './components/TimeControls/TimeControls';
import { EventLog } from './components/EventLog/EventLog';
import type { Position } from './types';
import type { Order as ComponentOrder } from './types';

function App() {
  // Get state and actions from Zustand store
  const gameState = useGameStore((s) => s.state);
  const gameEvents = useGameStore((s) => s.events);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const startBattle = useGameStore((s) => s.startBattle);
  const selectUnit = useGameStore((s) => s.selectUnit);
  const clearEvents = useGameStore((s) => s.clearEvents);
  const issueOrders = useGameStore((s) => s.issueOrders);

  // Convert engine state to component-friendly format
  const state = convertGameStateToBattleState(gameState);
  const events = convertGameEventsToBattleEvents(gameEvents);

  const [clickedPosition, setClickedPosition] = useState<Position | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Start battle on mount
  useEffect(() => {
    startBattle();
  }, [startBattle]);

  const handleUnitClick = (unitId: string) => {
    selectUnit(unitId);
    setClickedPosition(null); // Clear clicked position when selecting a unit
  };

  const handleEmptyClick = (worldPos: Position) => {
    if (selectedUnitId) {
      // Auto-submit move order (RTS style)
      console.log('[App] Auto-submitting move order to', worldPos);
      const order: ComponentOrder = {
        kind: 'move',
        unit_id: selectedUnitId,
        target_pos: worldPos,
      };
      handleSubmitOrder(order);
      setClickedPosition(worldPos); // Also set for visual feedback
    } else {
      selectUnit(null);
      setClickedPosition(null);
    }
  };

  const handleBattleStarted = () => {
    selectUnit(null);
    clearEvents();
    startBattle();
  };

  const handleSubmitOrder = async (order: ComponentOrder): Promise<boolean> => {
    setIsSubmittingOrder(true);
    setOrderError(null);

    try {
      const engineOrder = convertComponentOrderToEngineOrder(order);
      issueOrders([engineOrder]);
      return true;
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : 'Failed to submit order');
      return false;
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <div className="app-container">
      <Header state={state} onBattleStarted={handleBattleStarted} />

      <main className="app-main">
        {!state ? (
          <div className="loading-container">
            <p>Initializing battle...</p>
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
              <PixiBattlefield
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
                onSubmitOrder={handleSubmitOrder}
                isSubmitting={isSubmittingOrder}
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
