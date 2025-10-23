import { useState } from 'react';

export function useSelection() {
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  const selectUnit = (unitId: string | null) => {
    setSelectedUnitId(unitId);
  };

  const clearSelection = () => {
    setSelectedUnitId(null);
  };

  return {
    selectedUnitId,
    selectUnit,
    clearSelection,
  };
}
