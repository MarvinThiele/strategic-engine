/**
 * Adapter to convert component Order to engine Order
 */

import type { Order as ComponentOrder } from '../types';
import type { Order as EngineOrder } from '../engine/model';
import { OrderKind } from '../engine/model';

export function convertComponentOrderToEngineOrder(order: ComponentOrder): EngineOrder {
  const engineOrder: EngineOrder = {
    kind: order.kind === 'move' ? OrderKind.MOVE :
          order.kind === 'attack' ? OrderKind.ATTACK :
          OrderKind.STOP,
    unitId: order.unit_id,
  };

  if (order.target_pos) {
    engineOrder.targetPos = [order.target_pos[0], order.target_pos[1]] as const;
  }

  if (order.target_unit_id) {
    engineOrder.targetId = order.target_unit_id;
  }

  return engineOrder;
}
