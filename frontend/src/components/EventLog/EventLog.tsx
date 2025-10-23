import { useRef, useEffect } from 'react';
import type { BattleEvent } from '../../types';

interface EventLogProps {
  events: BattleEvent[];
  onClear: () => void;
}

export function EventLog({ events, onClear }: EventLogProps) {
  const logRef = useRef<HTMLDivElement>(null);

  // Limit to latest 200 events for performance
  const displayEvents = events.slice(-200);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  const getEventColor = (eventType: string): string => {
    switch (eventType) {
      case 'UNIT_MOVED':
        return '#4a9eff';
      case 'UNIT_DETECTED':
        return '#ffa500';
      case 'UNIT_FIRED':
        return '#ff4444';
      case 'UNIT_HIT':
        return '#ff0000';
      case 'UNIT_DESTROYED':
        return '#ff00ff';
      case 'UNIT_ROUTED':
        return '#ffff00';
      case 'ORDER_RECEIVED':
        return '#44ff44';
      default:
        return '#888';
    }
  };

  const formatEventMessage = (event: BattleEvent): string => {
    const time = `[${(event.ts_ms / 1000).toFixed(1)}s]`;

    switch (event.kind) {
      case 'UNIT_MOVED':
        return `${time} ${event.data.unit_id} moved to (${(event.data.pos[0] / 1000).toFixed(1)}, ${(event.data.pos[1] / 1000).toFixed(1)}) km`;

      case 'UNIT_DETECTED':
        return `${time} ${event.data.detector_id} detected ${event.data.target_id}`;

      case 'UNIT_FIRED':
        return `${time} ${event.data.attacker_id} fired at ${event.data.target_id}`;

      case 'UNIT_HIT':
        return `${time} ${event.data.target_id} hit by ${event.data.attacker_id} (${event.data.damage.toFixed(1)} dmg)`;

      case 'UNIT_DESTROYED':
        return `${time} ${event.data.unit_id} DESTROYED`;

      case 'UNIT_ROUTED':
        return `${time} ${event.data.unit_id} ROUTED`;

      case 'ORDER_RECEIVED':
        return `${time} Order received for ${event.data.unit_id}: ${event.data.kind}`;

      default:
        return `${time} ${event.kind}`;
    }
  };

  return (
    <div className="event-log">
      <div className="event-log-header">
        <h3>Battle Log</h3>
        <button onClick={onClear} className="btn-clear" disabled={events.length === 0}>
          Clear
        </button>
      </div>

      <div className="event-list" ref={logRef}>
        {displayEvents.length === 0 ? (
          <p className="no-events">No events yet</p>
        ) : (
          displayEvents.map((event, index) => (
            <div
              key={`${event.ts_ms}-${index}`}
              className="event-item"
              style={{ borderLeftColor: getEventColor(event.kind) }}
            >
              {formatEventMessage(event)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
