from dataclasses import dataclass, field
from typing import Dict, List, Literal, Optional, Tuple, Set
from enum import Enum

Side = Literal["BLUE", "RED"]
Position = Tuple[float, float]  # (x, y) in meters

class WeaponType(Enum):
    """Type of weapon system"""
    DIRECT_FIRE = "direct_fire"      # Tanks, IFVs - must see target
    INDIRECT_FIRE = "indirect_fire"  # Artillery - can fire at spotted targets
    SMALL_ARMS = "small_arms"        # Infantry rifles
    ANTI_TANK = "anti_tank"          # AT missiles

class UnitClass(Enum):
    """Unit classification"""
    RECON = "recon"
    INFANTRY = "infantry"
    MBT = "mbt"
    ARTILLERY = "artillery"

@dataclass
class UnitType:
    """Template defining characteristics of a unit type"""
    name: str
    unit_class: UnitClass
    max_hp: float
    speed_mps: float
    sensor_range_m: float
    weapon_type: WeaponType
    weapon_range_m: float
    damage: float
    reload_time_s: float
    armor: int  # 0=none, 1=light, 2=medium, 3=heavy
    visibility: float  # How easy to spot (0.5=concealed, 1.0=normal, 1.5=visible)
    max_ammo: int

# Predefined unit types
UNIT_TYPES = {
    "RECON": UnitType(
        name="Reconnaissance Vehicle",
        unit_class=UnitClass.RECON,
        max_hp=50,
        speed_mps=4.0,
        sensor_range_m=2500,  # Superior sensors - best in class
        weapon_type=WeaponType.SMALL_ARMS,
        weapon_range_m=400,
        damage=5,
        reload_time_s=2.0,
        armor=1,
        visibility=0.5,  # Hard to spot - small, quiet, stealthy
        max_ammo=200
    ),
    "INFANTRY": UnitType(
        name="Infantry Squad",
        unit_class=UnitClass.INFANTRY,
        max_hp=80,
        speed_mps=1.5,
        sensor_range_m=600,
        weapon_type=WeaponType.ANTI_TANK,
        weapon_range_m=500,
        damage=30,
        reload_time_s=5.0,
        armor=0,
        visibility=0.8,  # Can use cover, relatively small
        max_ammo=10
    ),
    "MBT": UnitType(
        name="Main Battle Tank",
        unit_class=UnitClass.MBT,
        max_hp=150,
        speed_mps=2.0,
        sensor_range_m=1000,
        weapon_type=WeaponType.DIRECT_FIRE,
        weapon_range_m=3000,
        damage=50,
        reload_time_s=6.0,
        armor=3,
        visibility=1.5,  # Easy to spot - large, hot engine, loud
        max_ammo=40
    ),
    "ARTILLERY": UnitType(
        name="Self-Propelled Howitzer",
        unit_class=UnitClass.ARTILLERY,
        max_hp=60,
        speed_mps=1.5,
        sensor_range_m=500,  # Poor sensors - needs spotters
        weapon_type=WeaponType.INDIRECT_FIRE,
        weapon_range_m=15000,
        damage=60,
        reload_time_s=15.0,
        armor=1,
        visibility=1.2,  # Large vehicle, somewhat visible
        max_ammo=30
    )
}

@dataclass
class Unit:
    id: str
    side: Side
    unit_type_id: str  # Key into UNIT_TYPES
    pos: Position  # (x, y) position in meters
    hp: float
    ammo: int
    target_id: Optional[str] = None
    intent_target_pos: Optional[Position] = None
    routed: bool = False
    last_fire_time: float = 0  # For reload tracking
    spotted_by: Set[str] = field(default_factory=set)  # IDs of friendly units that spot this enemy

    def get_type(self) -> UnitType:
        """Get the UnitType definition for this unit"""
        return UNIT_TYPES[self.unit_type_id]

@dataclass
class Order:
    kind: Literal["move", "attack", "defend"]
    unit_id: str
    target_pos: Optional[Position] = None  # (x, y) target position
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
