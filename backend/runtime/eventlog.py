from typing import List, Tuple
from engine.model import Event

class EventLog:
    """Append-only event storage for simulation replay and streaming."""

    def __init__(self):
        self._log: List[Event] = []

    def append_many(self, evts: List[Event]) -> Tuple[int, int]:
        """Append events and return (start_offset, end_offset)."""
        start = len(self._log)
        self._log.extend(evts)
        end = len(self._log) - 1
        return start, end

    def since(self, offset: int, limit: int = 1000) -> tuple[list[Event], int]:
        """Return events starting from offset, up to limit."""
        offset = max(0, offset)
        chunk = self._log[offset: offset + limit]
        return chunk, offset + len(chunk)
