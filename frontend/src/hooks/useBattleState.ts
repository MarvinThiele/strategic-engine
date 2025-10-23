import { useState, useEffect } from 'react';
import { battleAPI } from '../services/api';
import type { BattleState } from '../types';
import { API_POLL_INTERVAL } from '../utils/constants';

export function useBattleState() {
  const [state, setState] = useState<BattleState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchState = async () => {
      try {
        const newState = await battleAPI.getBattleState();
        if (isMounted) {
          setState(newState);
          setIsLoading(false);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsLoading(false);
        }
      }
    };

    // Initial fetch
    fetchState();

    // Poll for updates
    const interval = setInterval(fetchState, API_POLL_INTERVAL);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { state, isLoading, error };
}
