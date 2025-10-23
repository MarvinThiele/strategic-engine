"""Test that the engine produces deterministic results."""
import pytest
from engine.engine import Engine
from engine.model import Order, State, Unit


def make_test_state() -> State:
    """Create a simple test state."""
    units = {
        "B1": Unit(id="B1", side="BLUE", pos_m=1000, speed_mps=2.0, hp=100, ammo=40, sensor_range_m=800),
        "R1": Unit(id="R1", side="RED", pos_m=9000, speed_mps=2.0, hp=100, ammo=40, sensor_range_m=800),
    }
    return State(ts_ms=0, units=units, battle_id="test")


def test_engine_determinism():
    """Same seed and orders should produce identical results."""
    seed = 42
    orders = [Order(kind="move", unit_id="B1", target_pos_m=5000.0)]

    # Run simulation 1
    eng1 = Engine(seed, make_test_state())
    eng1.apply_orders(orders)
    events1 = []
    for _ in range(10):
        events1.extend(eng1.step(500))

    # Run simulation 2 with same seed
    eng2 = Engine(seed, make_test_state())
    eng2.apply_orders(orders)
    events2 = []
    for _ in range(10):
        events2.extend(eng2.step(500))

    # Results should be identical
    assert len(events1) == len(events2)
    for e1, e2 in zip(events1, events2):
        assert e1.kind == e2.kind
        assert e1.ts_ms == e2.ts_ms
        assert e1.data == e2.data


def test_different_seeds_produce_different_results():
    """Different seeds should produce different combat outcomes."""
    # Create units close enough to engage in combat
    def make_combat_state() -> State:
        units = {
            "B1": Unit(id="B1", side="BLUE", pos_m=1000, speed_mps=2.0, hp=100, ammo=40, sensor_range_m=800),
            "R1": Unit(id="R1", side="RED", pos_m=1500, speed_mps=2.0, hp=100, ammo=40, sensor_range_m=800),
        }
        return State(ts_ms=0, units=units, battle_id="test")

    # Run with seed 1
    eng1 = Engine(1, make_combat_state())
    for _ in range(100):
        eng1.step(500)
    state1 = eng1.snapshot()

    # Run with seed 2
    eng2 = Engine(2, make_combat_state())
    for _ in range(100):
        eng2.step(500)
    state2 = eng2.snapshot()

    # HP values should differ due to different RNG in combat
    b1_hp1 = state1.units["B1"].hp
    b1_hp2 = state2.units["B1"].hp

    # After 100 steps of combat at close range, different seeds should produce different outcomes
    # Check HP or ammo differs (combat happened differently)
    assert b1_hp1 != b1_hp2 or state1.units["B1"].ammo != state2.units["B1"].ammo
