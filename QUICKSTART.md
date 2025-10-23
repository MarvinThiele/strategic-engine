# Quick Start Guide

## Running the Application

### 1. Start the Backend (FastAPI)

```bash
cd backend
python -m uvicorn api.app:app --reload --port 8000
```

The backend will be available at `http://localhost:8000`

### 2. Start the Frontend (React + Vite)

In a separate terminal:

```bash
cd frontend
npm install  # First time only
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Usage

1. **Start a Battle**: Enter a seed number and click "New Battle"
2. **View Units**: Units are displayed in the left panel, separated by BLUE and RED forces
3. **Select a Unit**: Click on a unit card in the panel or click directly on the battlefield
4. **Issue Orders**:
   - **Move**: Select "Move" order type, enter coordinates (0-10 km), or click on battlefield
   - **Attack**: Select "Attack" order type, enter target unit ID
5. **Time Control**: Use speed buttons (Pause, 0.5x, 1x, 30x, 100x) to control simulation speed
6. **Monitor Events**: Watch the battle log for real-time events (movement, detection, combat)

## Features

- **2D Tactical Battlefield**: 10km x 10km grid with visual unit representation
- **Real-time Updates**: State polling every 500ms
- **Click-to-Select**: Interactive unit selection on canvas
- **Visual Feedback**:
  - Unit sensor ranges (transparent circles)
  - HP bars with color coding
  - Movement intent paths (dashed lines)
  - Selection highlighting (yellow ring)
  - Routed units (grayed out)
- **Time Compression**: Control simulation speed from pause to 100x
- **Event Streaming**: Live battle log with color-coded events

## Architecture

### Backend (Python)
- `backend/engine/`: Pure deterministic engine with 2D combat logic
- `backend/runtime/`: Async tick runner and event log
- `backend/api/`: FastAPI REST endpoints with CORS

### Frontend (TypeScript + React)
- `frontend/src/components/`: React components for UI
- `frontend/src/hooks/`: Custom hooks for state management
- `frontend/src/services/`: API client
- `frontend/src/types/`: TypeScript type definitions
- `frontend/src/utils/`: Geometry and constants

## Development

- Backend runs on port 8000
- Frontend dev server on port 5173
- Vite proxy routes `/battle/*` to backend
- Hot module reloading enabled for both frontend and backend

## API Documentation

For programmatic access, visit: **http://localhost:8000/docs**

This provides the Swagger UI with all API endpoints documented.
