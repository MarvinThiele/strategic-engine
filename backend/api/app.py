from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from engine.engine import Engine
from engine.model import Order, State, Unit
from runtime.runner import TickRunner
from .schemas import EventsResponse, OrderIn, StartRequest

app = FastAPI(title="Strategic Engine API")
runner: TickRunner | None = None

# Enable CORS for development (React runs on different port)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _make_initial_state() -> State:
    """Create default initial battle state with mixed unit types."""
    # 10km x 10km battlefield with varied force composition
    from engine.model import UNIT_TYPES

    units = {
        # BLUE Force: Combined arms group
        "B-RECON-1": Unit(id="B-RECON-1", side="BLUE", unit_type_id="RECON",
                          pos=(1000, 5000), hp=50, ammo=200),
        "B-INF-1": Unit(id="B-INF-1", side="BLUE", unit_type_id="INFANTRY",
                        pos=(1500, 3000), hp=80, ammo=10),
        "B-INF-2": Unit(id="B-INF-2", side="BLUE", unit_type_id="INFANTRY",
                        pos=(1500, 7000), hp=80, ammo=10),
        "B-MBT-1": Unit(id="B-MBT-1", side="BLUE", unit_type_id="MBT",
                        pos=(2000, 4000), hp=150, ammo=40),
        "B-MBT-2": Unit(id="B-MBT-2", side="BLUE", unit_type_id="MBT",
                        pos=(2000, 6000), hp=150, ammo=40),
        "B-ARTY-1": Unit(id="B-ARTY-1", side="BLUE", unit_type_id="ARTILLERY",
                         pos=(500, 5000), hp=60, ammo=30),

        # RED Force: Combined arms group
        "R-RECON-1": Unit(id="R-RECON-1", side="RED", unit_type_id="RECON",
                          pos=(9000, 5000), hp=50, ammo=200),
        "R-INF-1": Unit(id="R-INF-1", side="RED", unit_type_id="INFANTRY",
                        pos=(8500, 3000), hp=80, ammo=10),
        "R-INF-2": Unit(id="R-INF-2", side="RED", unit_type_id="INFANTRY",
                        pos=(8500, 7000), hp=80, ammo=10),
        "R-MBT-1": Unit(id="R-MBT-1", side="RED", unit_type_id="MBT",
                        pos=(8000, 4000), hp=150, ammo=40),
        "R-MBT-2": Unit(id="R-MBT-2", side="RED", unit_type_id="MBT",
                        pos=(8000, 6000), hp=150, ammo=40),
        "R-ARTY-1": Unit(id="R-ARTY-1", side="RED", unit_type_id="ARTILLERY",
                         pos=(9500, 5000), hp=60, ammo=30),
    }
    return State(ts_ms=0, units=units, battle_id="local")

@app.get("/")
async def root():
    """API root endpoint."""
    return {
        "message": "Strategic Engine API",
        "docs": "/docs",
        "version": "2.0"
    }

@app.on_event("startup")
async def startup():
    """Initialize and start the simulation on app startup."""
    global runner
    eng = Engine(seed=42, initial_state=_make_initial_state())
    runner = TickRunner(eng, tick_ms=500, time_compression=30.0)
    await runner.start()

@app.on_event("shutdown")
async def shutdown():
    """Stop the simulation on app shutdown."""
    global runner
    if runner:
        await runner.stop()

@app.post("/battle/start")
async def start_battle(req: StartRequest):
    """Start a new battle with specified seed."""
    await shutdown()
    global runner
    eng = Engine(seed=req.seed, initial_state=_make_initial_state())
    runner = TickRunner(eng, tick_ms=500, time_compression=30.0)
    await runner.start()
    return {"battle_id": "local"}

@app.post("/battle/local/orders")
async def post_orders(orders: list[OrderIn]):
    """Submit orders for units."""
    if not runner:
        raise HTTPException(400, "Battle not started")
    order_objs = [Order(**o.model_dump()) for o in orders]
    print(f"[API] Received {len(order_objs)} orders: {order_objs}")
    await runner.enqueue_orders(order_objs)
    return {"queued": len(orders)}

@app.get("/battle/local/state")
async def get_state():
    """Get current battle state snapshot."""
    if not runner:
        raise HTTPException(400, "Battle not started")
    s = await runner.snapshot()
    return {
        "ts_ms": s.ts_ms,
        "units": {
            uid: {
                "id": u.id,
                "side": u.side,
                "unit_type_id": u.unit_type_id,
                "pos": list(u.pos),  # Convert tuple to list for JSON
                "hp": u.hp,
                "ammo": u.ammo,
                "routed": u.routed,
                "intent_target_pos": list(u.intent_target_pos) if u.intent_target_pos else None,
                "target_id": u.target_id
            } for uid, u in s.units.items()
        }
    }

@app.get("/battle/local/events")
async def get_events(since: int = 0, limit: int = 500):
    """Get events since offset."""
    if not runner:
        raise HTTPException(400, "Battle not started")
    evts, next_offset = runner.events.since(since, limit)
    return EventsResponse(
        next_offset=next_offset,
        events=[{"kind": e.kind, "ts_ms": e.ts_ms, "data": e.data} for e in evts]
    )

@app.post("/battle/local/time-control")
async def set_time_control(time_compression: float):
    """Set simulation time compression (1.0 = real-time, higher = faster)."""
    if not runner:
        raise HTTPException(400, "Battle not started")
    runner.set_time_compression(time_compression)
    return {"time_compression": runner.time_compression}

@app.get("/battle/local/time-control")
async def get_time_control():
    """Get current time compression setting."""
    if not runner:
        raise HTTPException(400, "Battle not started")
    return {"time_compression": runner.time_compression}
