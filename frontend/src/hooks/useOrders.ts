import { useState } from 'react';
import { battleAPI } from '../services/api';
import type { Order } from '../types';

export function useOrders() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitOrder = async (order: Order): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);

    try {
      await battleAPI.submitOrders([order]);
      setIsSubmitting(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit order');
      setIsSubmitting(false);
      return false;
    }
  };

  return {
    submitOrder,
    isSubmitting,
    error,
  };
}
