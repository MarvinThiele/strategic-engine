import math
from typing import Dict, List
from .model import Event, Order, State, Unit
from .rng import DRNG

class Engine:
    """Pure, deterministic simulation engine."""

    def __init__(self, seed: int, initial_state: State):
        self.state = initial_state
        self._rng = DRNG(seed)
        self._pending_orders: List[Order] = []
        self.base_acc = 0.6
        self.decay_m = 600.0
        self.dmg_min = 8.0
        self.dmg_max = 15.0

    def apply_orders(self, orders: List[Order]) -> None:
        """Queue orders to be applied on next step."""
        self._pending_orders.extend(orders)

    def _apply_orders_now(self) -> List[Event]:
        """Process queued orders and return events."""
        evts: List[Event] = []
        #print(f"[Engine] Processing {len(self._pending_orders)} orders")
        for o in self._pending_orders:
            u = self.state.units.get(o.unit_id)
            if not u:
                print(f"[Engine] WARNING: Unit {o.unit_id} not found! Available units: {list(self.state.units.keys())}")
                continue
            if u.routed:
                print(f"[Engine] WARNING: Unit {o.unit_id} is routed, ignoring order")
                continue
            if o.kind == "move" and o.target_pos_m is not None:
                print(f"[Engine] Unit {u.id}: move to {o.target_pos_m}m")
                u.intent_target_pos_m = float(o.target_pos_m)
                evts.append(Event("OrderAccepted", self.state.ts_ms,
                                {"unit_id": u.id, "kind": "move", "to": u.intent_target_pos_m}))
            elif o.kind == "attack" and o.target_unit_id:
                print(f"[Engine] Unit {u.id}: attack {o.target_unit_id}")
                u.target_id = o.target_unit_id
                evts.append(Event("OrderAccepted", self.state.ts_ms,
                                {"unit_id": u.id, "kind": "attack", "target": u.target_id}))
            elif o.kind == "defend":
                print(f"[Engine] Unit {u.id}: defend")
                u.intent_target_pos_m = None
                u.target_id = None
                evts.append(Event("OrderAccepted", self.state.ts_ms,
                                {"unit_id": u.id, "kind": "defend"}))
        self._pending_orders.clear()
        return evts

    def _move(self, dt_ms: int) -> List[Event]:
        """Update unit positions based on movement intents."""
        evts: List[Event] = []
        dt = dt_ms / 1000.0
        for u in self.state.units.values():
            if u.intent_target_pos_m is None or u.routed:
                continue
            direction = 1.0 if u.intent_target_pos_m > u.pos_m else -1.0
            max_step = u.speed_mps * dt
            dist = abs(u.intent_target_pos_m - u.pos_m)
            step = min(max_step, dist)
            old = u.pos_m
            u.pos_m += direction * step
            if u.pos_m != old:
                evts.append(Event("UnitMoved", self.state.ts_ms,
                                {"unit_id": u.id, "pos_m": u.pos_m}))
        return evts

    def _detect_pairs(self) -> Dict[str, str]:
        """Detect enemy units within sensor range."""
        pairs: Dict[str, str] = {}
        ids = list(self.state.units.keys())
        for a_id in ids:
            a = self.state.units[a_id]
            best = None
            best_d = 1e9
            for b_id in ids:
                if a_id == b_id:
                    continue
                b = self.state.units[b_id]
                if a.side == b.side:
                    continue
                d = abs(a.pos_m - b.pos_m)
                if d <= a.sensor_range_m and d < best_d:
                    best, best_d = b_id, d
            if best is not None:
                pairs[a_id] = best
        return pairs

    def _combat(self, dt_ms: int, contacts: Dict[str, str]) -> List[Event]:
        """Resolve combat between detected pairs."""
        evts: List[Event] = []
        for shooter_id, target_id in contacts.items():
            s = self.state.units.get(shooter_id)
            t = self.state.units.get(target_id)
            if not s or not t or s.ammo <= 0 or s.routed:
                continue
            dist = abs(s.pos_m - t.pos_m)
            p = max(0.0, min(0.95, self.base_acc * math.exp(-dist / self.decay_m)))
            evts.append(Event("ShotFired", self.state.ts_ms,
                            {"shooter": s.id, "target": t.id, "dist_m": dist, "p": p}))
            s.ammo -= 1
            if self._rng.bernoulli(p):
                dmg = self._rng.uniform(self.dmg_min, self.dmg_max)
                t.hp -= dmg
                evts.append(Event("Damage", self.state.ts_ms,
                                {"target": t.id, "dmg": dmg, "hp": t.hp}))
                if t.hp <= 0:
                    evts.append(Event("Destroyed", self.state.ts_ms,
                                    {"unit_id": t.id}))
        return evts

    def _morale(self) -> List[Event]:
        """Check for unit routing based on damage."""
        evts: List[Event] = []
        for u in self.state.units.values():
            if u.routed:
                continue
            hp_pct = max(0.0, u.hp) / 100.0
            if hp_pct < 0.3:
                if self._rng.bernoulli(0.5):
                    u.routed = True
                    evts.append(Event("Routed", self.state.ts_ms,
                                    {"unit_id": u.id}))
        return evts

    def step(self, dt_ms: int) -> List[Event]:
        """Advance simulation by dt_ms milliseconds."""
        evts: List[Event] = []
        evts += self._apply_orders_now()
        evts += self._move(dt_ms)
        contacts = self._detect_pairs()
        for u_id, t_id in contacts.items():
            evts.append(Event("Contact", self.state.ts_ms,
                            {"unit_id": u_id, "target_id": t_id}))
        evts += self._combat(dt_ms, contacts)
        evts += self._morale()
        self.state.ts_ms += dt_ms
        return evts

    def snapshot(self) -> State:
        """Return current state."""
        return self.state
