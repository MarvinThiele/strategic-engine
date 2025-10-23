import asyncio
from typing import List
from engine.engine import Engine
from engine.model import Event, Order, State
from .eventlog import EventLog

class TickRunner:
    """Async driver that runs the engine on a fixed tick cadence."""

    def __init__(self, engine: Engine, tick_ms: int = 500, time_compression: float = 30.0):
        self.engine = engine
        self.tick_ms = tick_ms
        self.time_compression = time_compression
        self.sleep_s = (tick_ms / 1000.0) / max(1.0, time_compression)
        self._orders: asyncio.Queue[List[Order]] = asyncio.Queue()
        self.events = EventLog()
        self._task: asyncio.Task | None = None
        self._lock = asyncio.Lock()

    async def start(self):
        """Start the tick loop."""
        if self._task:
            return
        self._task = asyncio.create_task(self._loop())

    async def stop(self):
        """Stop the tick loop gracefully."""
        if not self._task:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None

    async def _loop(self):
        """Main tick loop - batch orders, step engine, log events."""
        while True:
            batched: List[Order] = []
            # Drain all pending orders from the queue
            while not self._orders.empty():
                try:
                    order_batch = self._orders.get_nowait()
                    batched += order_batch
                except asyncio.QueueEmpty:
                    break

            async with self._lock:
                if batched:
                    print(f"[TickRunner] Applying {len(batched)} orders to engine: {batched}")
                    self.engine.apply_orders(batched)
                evts: List[Event] = self.engine.step(self.tick_ms)

            if evts:
                print(f"[TickRunner] Tick produced {len(evts)} events")
            self.events.append_many(evts)
            await asyncio.sleep(self.sleep_s)

    async def enqueue_orders(self, orders: List[Order]):
        """Queue orders to be applied on next tick."""
        print(f"[TickRunner] Enqueuing {len(orders)} orders")
        await self._orders.put(orders)

    async def snapshot(self) -> State:
        """Get current state (thread-safe)."""
        async with self._lock:
            return self.engine.snapshot()

    def set_time_compression(self, time_compression: float):
        """Update time compression factor (1.0 = real-time, higher = faster)."""
        self.time_compression = max(0.1, min(1000.0, time_compression))
        self.sleep_s = (self.tick_ms / 1000.0) / max(1.0, self.time_compression)
        print(f"[TickRunner] Time compression set to {self.time_compression}x (sleep: {self.sleep_s:.4f}s)")
