from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from engine.engine import Engine
from engine.model import Order, State, Unit
from runtime.runner import TickRunner
from .schemas import EventsResponse, OrderIn, StartRequest
import os

app = FastAPI(title="Hybrid War Toy")
runner: TickRunner | None = None

# Mount static files
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

def _make_initial_state() -> State:
    """Create default initial battle state."""
    units = {
        "B1": Unit(id="B1", side="BLUE", pos_m=1000, speed_mps=2.0, hp=100, ammo=40, sensor_range_m=800),
        "B2": Unit(id="B2", side="BLUE", pos_m=1200, speed_mps=2.0, hp=100, ammo=40, sensor_range_m=800),
        "R1": Unit(id="R1", side="RED",  pos_m=9000, speed_mps=2.0, hp=100, ammo=40, sensor_range_m=800),
        "R2": Unit(id="R2", side="RED",  pos_m=8800, speed_mps=2.0, hp=100, ammo=40, sensor_range_m=800),
    }
    return State(ts_ms=0, units=units, battle_id="local")

@app.get("/")
async def root():
    """Serve the web interface."""
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Strategic Engine API - visit /docs for API documentation"}

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
                "id": u.id, "side": u.side, "pos_m": u.pos_m, "hp": u.hp, "ammo": u.ammo,
                "routed": u.routed, "intent_target_pos_m": u.intent_target_pos_m, "target_id": u.target_id
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
