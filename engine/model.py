from dataclasses import dataclass, field
from typing import Dict, List, Literal, Optional

Side = Literal["BLUE", "RED"]

@dataclass
class Unit:
    id: str
    side: Side
    pos_m: float
    speed_mps: float
    hp: float
    ammo: int
    sensor_range_m: float
    target_id: Optional[str] = None
    intent_target_pos_m: Optional[float] = None
    routed: bool = False

@dataclass
class Order:
    kind: Literal["move", "attack", "defend"]
    unit_id: str
    target_pos_m: Optional[float] = None
    target_unit_id: Optional[str] = None
    client_ts_ms: int = 0

@dataclass
class Event:
    kind: str
    ts_ms: int
    data: Dict

@dataclass
class State:
    ts_ms: int
    units: Dict[str, Unit] = field(default_factory=dict)
    battle_id: str = "local"
