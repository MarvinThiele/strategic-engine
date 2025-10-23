import { useState, useEffect } from 'react';
import { battleAPI } from '../services/api';
import type { BattleEvent } from '../types';
import { API_POLL_INTERVAL } from '../utils/constants';

export function useEventStream() {
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchEvents = async () => {
      try {
        const response = await battleAPI.getEvents(offset, 100);
        if (isMounted && response.events.length > 0) {
          setEvents(prev => [...response.events, ...prev]); // Prepend new events
          setOffset(response.next_offset);
        }
      } catch (err) {
        console.error('Failed to fetch events:', err);
      }
    };

    const interval = setInterval(fetchEvents, API_POLL_INTERVAL);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [offset]);

  const clearEvents = () => {
    setEvents([]);
  };

  return { events, clearEvents };
}
