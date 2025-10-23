# Quick Start Guide

## Running the Application

1. **Start the server:**
   ```bash
   python main.py
   ```

2. **Open your browser:**
   Navigate to: **http://localhost:8000**

   You should see the Strategic Engine Battle Viewer interface!

## Using the Web Interface

### Battle Visualization
- The main canvas shows a 10km battlefield
- **Blue triangles (pointing up)**: BLUE forces
- **Red triangles (pointing down)**: RED forces
- **Circles around units**: Sensor range (800m)
- **Dashed lines**: Movement intent
- **HP bars**: Health status (green/yellow/red)

### Controls

**New Battle:**
- Click "New Battle" button
- Optionally change the seed number for different RNG outcomes
- Default seed is 42

**Issue Orders:**
1. Select a unit from the dropdown
2. Choose order type:
   - **Move**: Move to a position (in meters, 0-10000)
   - **Attack**: Target a specific enemy unit
   - **Defend**: Stop and hold position
3. Click "Send Order"

### Unit Status Panel
Shows real-time stats for all units:
- Position on battlefield
- HP (health points)
- Ammo remaining
- Status (Active/Routed)

### Event Log
Real-time stream of battle events:
- Movement updates
- Contact detection
- Combat actions (shots fired)
- Damage dealt
- Unit status changes

## Example Battle Scenario

1. **Start a new battle** (seed: 42)

2. **Move BLUE forces forward:**
   - Select "B1", choose "Move", enter "5000", click "Send Order"
   - Select "B2", choose "Move", enter "5000", click "Send Order"

3. **Move RED forces forward:**
   - Select "R1", choose "Move", enter "5000", click "Send Order"
   - Select "R2", choose "Move", enter "5000", click "Send Order"

4. **Watch the battle unfold!**
   - Units will detect enemies when within sensor range (800m)
   - Combat automatically starts when contact is made
   - Watch HP bars and the event log for details

## Tips

- Units move at 2 m/s (meters per second)
- Sensor range is 800m
- Hit probability decreases with distance (exponential decay)
- Units may route when HP drops below 30%
- The simulation runs with 30x time compression

## API Documentation

For programmatic access, visit: **http://localhost:8000/docs**

This provides the Swagger UI with all API endpoints documented.
