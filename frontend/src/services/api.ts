import type {
  BattleState,
  StartBattleRequest,
  StartBattleResponse,
  Order,
  SubmitOrdersResponse,
  EventsResponse,
  TimeControlResponse,
} from '../types';

// Note: This API client is no longer used since the engine runs in the frontend
// Keeping it for potential future multiplayer or server-based features
class BattleAPIClient {
  /**
   * Get current battle state
   */
  async getBattleState(): Promise<BattleState> {
    const response = await fetch('/battle/local/state');
    if (!response.ok) {
      throw new Error(`Failed to fetch battle state: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Start a new battle
   */
  async startBattle(seed: number): Promise<StartBattleResponse> {
    const request: StartBattleRequest = { seed };
    const response = await fetch('/battle/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(`Failed to start battle: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Submit orders for units
   */
  async submitOrders(orders: Order[]): Promise<SubmitOrdersResponse> {
    const response = await fetch('/battle/local/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orders),
    });
    if (!response.ok) {
      throw new Error(`Failed to submit orders: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get events since a specific offset
   */
  async getEvents(since: number = 0, limit: number = 100): Promise<EventsResponse> {
    const response = await fetch(`/battle/local/events?since=${since}&limit=${limit}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Set time compression
   */
  async setTimeCompression(speed: number): Promise<TimeControlResponse> {
    const response = await fetch(`/battle/local/time-control?time_compression=${speed}`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Failed to set time compression: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get current time compression
   */
  async getTimeCompression(): Promise<TimeControlResponse> {
    const response = await fetch('/battle/local/time-control');
    if (!response.ok) {
      throw new Error(`Failed to get time compression: ${response.statusText}`);
    }
    return response.json();
  }
}

// Export singleton instance
export const battleAPI = new BattleAPIClient();
