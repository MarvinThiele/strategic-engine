"""Test the FastAPI endpoints."""
import pytest
from httpx import AsyncClient
from api.app import app


@pytest.mark.asyncio
async def test_start_battle():
    """Test starting a new battle."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/battle/start", json={"seed": 123})
    assert response.status_code == 200
    assert response.json() == {"battle_id": "local"}


@pytest.mark.asyncio
async def test_get_state():
    """Test getting battle state."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        await ac.post("/battle/start", json={"seed": 42})
        response = await ac.get("/battle/local/state")

    assert response.status_code == 200
    data = response.json()
    assert "ts_ms" in data
    assert "units" in data
    assert len(data["units"]) == 4  # B1, B2, R1, R2


@pytest.mark.asyncio
async def test_post_orders():
    """Test submitting orders."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        await ac.post("/battle/start", json={"seed": 42})
        response = await ac.post("/battle/local/orders", json=[
            {"kind": "move", "unit_id": "B1", "target_pos_m": 5000.0}
        ])

    assert response.status_code == 200
    assert response.json() == {"queued": 1}


@pytest.mark.asyncio
async def test_get_events():
    """Test retrieving events."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        await ac.post("/battle/start", json={"seed": 42})
        await ac.post("/battle/local/orders", json=[
            {"kind": "move", "unit_id": "B1", "target_pos_m": 5000.0}
        ])
        # Wait a moment for tick to process
        import asyncio
        await asyncio.sleep(0.1)
        response = await ac.get("/battle/local/events?since=0")

    assert response.status_code == 200
    data = response.json()
    assert "next_offset" in data
    assert "events" in data
