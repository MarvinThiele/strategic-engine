import math
from typing import Dict, List, Tuple, Set
from .model import Event, Order, Position, State, Unit, WeaponType
from .rng import DRNG

def distance_2d(pos1: Position, pos2: Position) -> float:
    """Calculate Euclidean distance between two 2D positions."""
    dx = pos2[0] - pos1[0]
    dy = pos2[1] - pos1[1]
    return math.sqrt(dx * dx + dy * dy)

def normalize_2d(vec: Tuple[float, float]) -> Tuple[float, float]:
    """Normalize a 2D vector to unit length."""
    mag = math.sqrt(vec[0] * vec[0] + vec[1] * vec[1])
    if mag < 0.001:
        return (0.0, 0.0)
    return (vec[0] / mag, vec[1] / mag)

class Engine:
    """Pure, deterministic simulation engine."""

    def __init__(self, seed: int, initial_state: State):
        self.state = initial_state
        self._rng = DRNG(seed)
        self._pending_orders: List[Order] = []
        self.base_acc = 0.7
        self.decay_m = 800.0

    def apply_orders(self, orders: List[Order]) -> None:
        """Queue orders to be applied on next step."""
        self._pending_orders.extend(orders)

    def _apply_orders_now(self) -> List[Event]:
        """Process queued orders and return events."""
        evts: List[Event] = []
        for o in self._pending_orders:
            u = self.state.units.get(o.unit_id)
            if not u:
                continue
            if u.routed:
                continue
            if o.kind == "move" and o.target_pos is not None:
                u.intent_target_pos = o.target_pos
                evts.append(Event("OrderAccepted", self.state.ts_ms,
                                {"unit_id": u.id, "kind": "move", "to": list(u.intent_target_pos)}))
            elif o.kind == "attack" and o.target_unit_id:
                u.target_id = o.target_unit_id
                evts.append(Event("OrderAccepted", self.state.ts_ms,
                                {"unit_id": u.id, "kind": "attack", "target": u.target_id}))
            elif o.kind == "defend":
                u.intent_target_pos = None
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
            if u.intent_target_pos is None or u.routed:
                continue

            u_type = u.get_type()

            # Calculate direction vector
            dx = u.intent_target_pos[0] - u.pos[0]
            dy = u.intent_target_pos[1] - u.pos[1]
            dist = math.sqrt(dx * dx + dy * dy)

            if dist < 0.1:  # Already at target
                continue

            # Normalize direction
            dir_x = dx / dist
            dir_y = dy / dist

            # Calculate step using unit type speed
            max_step = u_type.speed_mps * dt
            step = min(max_step, dist)

            # Update position
            old_pos = u.pos
            new_x = u.pos[0] + dir_x * step
            new_y = u.pos[1] + dir_y * step
            u.pos = (new_x, new_y)

            # Don't emit UnitMoved events - too noisy for event log
        return evts

    def _can_detect(self, detector: Unit, target: Unit) -> bool:
        """Check if detector can see target based on visibility and sensor range."""
        dist = distance_2d(detector.pos, target.pos)
        det_type = detector.get_type()
        tgt_type = target.get_type()

        # Visibility multiplier - easy to spot targets extend effective range
        # No hard cap - a large visible target (tank) can be spotted beyond base sensor range
        # Example: 2500m sensor * 1.5 visibility = 3750m effective range vs tanks
        effective_range = det_type.sensor_range_m * tgt_type.visibility

        return dist <= effective_range

    def _update_spotting(self) -> List[Event]:
        """Update which enemy units are spotted by friendlies (shared vision)."""
        evts: List[Event] = []

        # Clear all spotting
        for u in self.state.units.values():
            u.spotted_by.clear()

        # Update spotting
        for detector in self.state.units.values():
            if detector.routed:
                continue
            for target in self.state.units.values():
                if detector.side != target.side:
                    if self._can_detect(detector, target):
                        # Don't emit UnitDetected events - too spammy
                        target.spotted_by.add(detector.id)

        return evts

    def _can_fire_at(self, attacker: Unit, target: Unit, current_time: float) -> bool:
        """Check if attacker can fire at target based on weapon type and reload."""
        a_type = attacker.get_type()

        # Check reload time
        time_since_fire = (current_time - attacker.last_fire_time) / 1000.0  # Convert to seconds
        if time_since_fire < a_type.reload_time_s:
            return False

        # Check ammo
        if attacker.ammo <= 0:
            return False

        # Check range
        dist = distance_2d(attacker.pos, target.pos)
        if dist > a_type.weapon_range_m:
            return False

        # Direct fire: must see target directly
        if a_type.weapon_type == WeaponType.DIRECT_FIRE or \
           a_type.weapon_type == WeaponType.SMALL_ARMS or \
           a_type.weapon_type == WeaponType.ANTI_TANK:
            return self._can_detect(attacker, target)

        # Indirect fire: someone must spot the target
        elif a_type.weapon_type == WeaponType.INDIRECT_FIRE:
            return len(target.spotted_by) > 0

        return False

    def _calculate_damage(self, attacker: Unit, target: Unit, base_damage: float) -> float:
        """Calculate damage based on weapon type vs armor."""
        a_type = attacker.get_type()
        t_type = target.get_type()

        weapon = a_type.weapon_type
        armor = t_type.armor

        # Small arms barely scratch armored vehicles
        if weapon == WeaponType.SMALL_ARMS and armor >= 2:
            return base_damage * 0.1

        # Anti-tank weapons are effective against armor
        elif weapon == WeaponType.ANTI_TANK:
            if armor >= 2:
                return base_damage * 1.5
            else:
                return base_damage

        # Direct fire (tanks) good against medium armor, excellent vs light
        elif weapon == WeaponType.DIRECT_FIRE:
            if armor >= 3:
                return base_damage * 0.8
            elif armor >= 2:
                return base_damage * 1.2
            else:
                return base_damage * 1.5

        # Indirect fire (HE artillery) devastating vs soft targets
        elif weapon == WeaponType.INDIRECT_FIRE:
            if armor == 0:
                return base_damage * 2.0
            elif armor == 1:
                return base_damage * 1.2
            else:
                return base_damage * 0.6

        return base_damage

    def _find_targets(self) -> Dict[str, str]:
        """Find valid targets for each unit."""
        targets: Dict[str, str] = {}

        for u_id, u in self.state.units.items():
            if u.routed:
                continue

            # Find closest valid target
            best_target = None
            best_dist = float('inf')

            for t_id, t in self.state.units.items():
                if u.side == t.side or t.hp <= 0:
                    continue

                if self._can_fire_at(u, t, self.state.ts_ms):
                    dist = distance_2d(u.pos, t.pos)
                    if dist < best_dist:
                        best_target = t_id
                        best_dist = dist

            if best_target:
                targets[u_id] = best_target

        return targets

    def _combat(self, dt_ms: int, targets: Dict[str, str]) -> List[Event]:
        """Resolve combat between units and their targets."""
        evts: List[Event] = []

        for shooter_id, target_id in targets.items():
            s = self.state.units.get(shooter_id)
            t = self.state.units.get(target_id)

            if not s or not t or s.routed or t.hp <= 0:
                continue

            s_type = s.get_type()
            dist = distance_2d(s.pos, t.pos)

            # Calculate hit probability based on distance and weapon
            p = max(0.0, min(0.95, self.base_acc * math.exp(-dist / self.decay_m)))

            evts.append(Event("ShotFired", self.state.ts_ms,
                            {"shooter": s.id, "target": t.id, "dist_m": dist, "p": p,
                             "weapon": s_type.weapon_type.value}))

            s.ammo -= 1
            s.last_fire_time = self.state.ts_ms

            if self._rng.bernoulli(p):
                # Calculate damage with armor modifiers
                base_dmg = s_type.damage
                final_dmg = self._calculate_damage(s, t, base_dmg)

                t.hp -= final_dmg
                evts.append(Event("Damage", self.state.ts_ms,
                                {"target": t.id, "dmg": final_dmg, "hp": t.hp, "shooter": s.id}))

                if t.hp <= 0:
                    evts.append(Event("Destroyed", self.state.ts_ms,
                                    {"unit_id": t.id, "killer": s.id}))

        return evts

    def _morale(self) -> List[Event]:
        """Check for unit routing based on damage."""
        evts: List[Event] = []
        for u in self.state.units.values():
            if u.routed:
                continue

            u_type = u.get_type()
            hp_pct = max(0.0, u.hp) / u_type.max_hp

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
        evts += self._update_spotting()
        targets = self._find_targets()
        evts += self._combat(dt_ms, targets)
        evts += self._morale()
        self.state.ts_ms += dt_ms
        return evts

    def snapshot(self) -> State:
        """Return current state."""
        return self.state
