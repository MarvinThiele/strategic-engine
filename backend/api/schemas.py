from typing import Literal, Optional, Tuple
from pydantic import BaseModel, Field

class OrderIn(BaseModel):
    """Order request schema."""
    kind: Literal["move", "attack", "defend"]
    unit_id: str
    target_pos: Optional[Tuple[float, float]] = None  # (x, y) position
    target_unit_id: Optional[str] = None
    client_ts_ms: int = Field(default=0)

class StartRequest(BaseModel):
    """Battle start request schema."""
    seed: int = 42

class EventsResponse(BaseModel):
    """Events response schema."""
    next_offset: int
    events: list[dict]
