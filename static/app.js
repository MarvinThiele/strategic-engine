// State management
let eventOffset = 0;
let updateInterval = null;
let state = null;

// Canvas setup
const canvas = document.getElementById('battlefield');
const ctx = canvas.getContext('2d');
const BATTLEFIELD_LENGTH = 10000; // 10km in meters
const SCALE = canvas.width / BATTLEFIELD_LENGTH;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchState();
    startPolling();
});

function setupEventListeners() {
    document.getElementById('startBattle').addEventListener('click', startNewBattle);
    document.getElementById('submitOrder').addEventListener('click', submitOrder);
    document.getElementById('clearEvents').addEventListener('click', clearEventLog);
    document.getElementById('orderType').addEventListener('change', handleOrderTypeChange);

    // Time control buttons
    document.getElementById('pauseBtn').addEventListener('click', () => setTimeCompression(0.1));
    document.getElementById('slowBtn').addEventListener('click', () => setTimeCompression(0.5));
    document.getElementById('normalBtn').addEventListener('click', () => setTimeCompression(1.0));
    document.getElementById('fastBtn').addEventListener('click', () => setTimeCompression(30.0));
    document.getElementById('veryFastBtn').addEventListener('click', () => setTimeCompression(100.0));
}

function handleOrderTypeChange() {
    const orderType = document.getElementById('orderType').value;
    const targetPos = document.getElementById('targetPos');
    const targetUnit = document.getElementById('targetUnit');

    if (orderType === 'move') {
        targetPos.style.display = 'inline-block';
        targetUnit.style.display = 'none';
    } else if (orderType === 'attack') {
        targetPos.style.display = 'none';
        targetUnit.style.display = 'inline-block';
        updateTargetUnitOptions();
    } else { // defend
        targetPos.style.display = 'none';
        targetUnit.style.display = 'none';
    }
}

async function startNewBattle() {
    const seed = parseInt(document.getElementById('seedInput').value) || 42;

    try {
        const response = await fetch('/battle/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seed })
        });

        if (response.ok) {
            eventOffset = 0;
            clearEventLog();
            addEventToLog(`New battle started with seed ${seed}`, 'system');
            await fetchState();
        }
    } catch (error) {
        console.error('Error starting battle:', error);
        addEventToLog('Error starting battle', 'error');
    }
}

async function submitOrder() {
    const unitId = document.getElementById('unitSelect').value;
    const orderType = document.getElementById('orderType').value;
    const targetPos = document.getElementById('targetPos').value;
    const targetUnitId = document.getElementById('targetUnit').value;

    if (!unitId) {
        alert('Please select a unit');
        return;
    }

    const order = {
        kind: orderType,
        unit_id: unitId,
        client_ts_ms: Date.now()
    };

    if (orderType === 'move') {
        if (!targetPos) {
            alert('Please enter target position');
            return;
        }
        order.target_pos_m = parseFloat(targetPos);
    } else if (orderType === 'attack') {
        if (!targetUnitId) {
            alert('Please select target unit');
            return;
        }
        order.target_unit_id = targetUnitId;
    }

    try {
        console.log('Submitting order:', order);
        const response = await fetch('/battle/local/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([order])
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Order response:', result);
            addEventToLog(`Order issued: ${orderType} for ${unitId}`, 'system');
        } else {
            const errorText = await response.text();
            console.error('Order failed:', errorText);
            addEventToLog(`Order failed: ${errorText}`, 'error');
        }
    } catch (error) {
        console.error('Error submitting order:', error);
        addEventToLog('Error submitting order', 'error');
    }
}

async function fetchState() {
    try {
        const response = await fetch('/battle/local/state');
        if (!response.ok) {
            console.warn('Failed to fetch state:', response.status);
            return;
        }

        const newState = await response.json();

        // Log if state changed
        if (!state || state.ts_ms !== newState.ts_ms) {
            console.log('State update:', newState.ts_ms, 'ms');
        }

        state = newState;
        updateBattlefield();
        updateUnitsList();
        updateUnitSelects();
        document.getElementById('battleTime').textContent = `T+${(state.ts_ms / 1000).toFixed(1)}s`;
    } catch (error) {
        console.error('Error fetching state:', error);
    }
}

async function fetchEvents() {
    try {
        const response = await fetch(`/battle/local/events?since=${eventOffset}&limit=100`);
        if (!response.ok) return;

        const data = await response.json();

        if (data.events.length > 0) {
            data.events.forEach(event => {
                addEventToLog(formatEvent(event), getEventClass(event.kind));
            });
            eventOffset = data.next_offset;
        }
    } catch (error) {
        console.error('Error fetching events:', error);
    }
}

function updateBattlefield() {
    if (!state) return;

    // Clear canvas
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
        const x = (i * 1000) * SCALE;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();

        // Labels
        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        ctx.fillText(`${i}km`, x + 2, 12);
    }

    // Draw units
    Object.values(state.units).forEach(unit => {
        const x = unit.pos_m * SCALE;
        const y = canvas.height / 2;

        // Unit color based on side
        const color = unit.side === 'BLUE' ? '#4080ff' : '#ff4040';
        const size = 12;

        // Draw unit as triangle
        ctx.fillStyle = unit.routed ? '#666' : color;
        ctx.beginPath();
        if (unit.side === 'BLUE') {
            ctx.moveTo(x, y - size);
            ctx.lineTo(x + size, y + size);
            ctx.lineTo(x - size, y + size);
        } else {
            ctx.moveTo(x, y + size);
            ctx.lineTo(x + size, y - size);
            ctx.lineTo(x - size, y - size);
        }
        ctx.closePath();
        ctx.fill();

        // Draw sensor range
        ctx.strokeStyle = color + '40';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, unit.sensor_range_m * SCALE, 0, Math.PI * 2);
        ctx.stroke();

        // Unit label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(unit.id, x - 10, y - 20);

        // HP bar
        const hpWidth = 30;
        const hpHeight = 4;
        const hpRatio = Math.max(0, unit.hp / 100);
        ctx.fillStyle = '#333';
        ctx.fillRect(x - hpWidth/2, y + 20, hpWidth, hpHeight);
        ctx.fillStyle = hpRatio > 0.5 ? '#4f4' : hpRatio > 0.25 ? '#ff4' : '#f44';
        ctx.fillRect(x - hpWidth/2, y + 20, hpWidth * hpRatio, hpHeight);

        // Movement intent indicator
        if (unit.intent_target_pos_m !== null && !unit.routed) {
            const targetX = unit.intent_target_pos_m * SCALE;
            ctx.strokeStyle = color + '80';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(targetX, y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    });
}

function updateUnitsList() {
    if (!state) return;

    const unitsList = document.getElementById('unitsList');
    unitsList.innerHTML = '';

    Object.values(state.units).forEach(unit => {
        const unitDiv = document.createElement('div');
        unitDiv.className = `unit-card ${unit.side.toLowerCase()} ${unit.routed ? 'routed' : ''}`;

        const hpPercent = Math.max(0, (unit.hp / 100) * 100);

        unitDiv.innerHTML = `
            <div class="unit-header">
                <strong>${unit.id}</strong>
                <span class="badge">${unit.side}</span>
            </div>
            <div class="unit-stats">
                <div>Position: ${Math.round(unit.pos_m)}m</div>
                <div>HP: ${unit.hp.toFixed(1)}/100 (${hpPercent.toFixed(0)}%)</div>
                <div>Ammo: ${unit.ammo}/40</div>
                <div>Status: ${unit.routed ? 'ROUTED' : 'Active'}</div>
            </div>
        `;

        unitsList.appendChild(unitDiv);
    });
}

function updateUnitSelects() {
    if (!state) return;

    const unitSelect = document.getElementById('unitSelect');
    const currentValue = unitSelect.value;
    unitSelect.innerHTML = '<option value="">Select Unit...</option>';

    Object.values(state.units).forEach(unit => {
        const option = document.createElement('option');
        option.value = unit.id;
        option.textContent = `${unit.id} (${unit.side})`;
        if (unit.routed) option.textContent += ' - ROUTED';
        option.disabled = unit.routed;
        unitSelect.appendChild(option);
    });

    unitSelect.value = currentValue;
}

function updateTargetUnitOptions() {
    if (!state) return;

    const selectedUnit = document.getElementById('unitSelect').value;
    const targetSelect = document.getElementById('targetUnit');
    targetSelect.innerHTML = '<option value="">Select Target...</option>';

    if (!selectedUnit) return;

    const selectedSide = state.units[selectedUnit]?.side;

    Object.values(state.units).forEach(unit => {
        if (unit.side !== selectedSide) {
            const option = document.createElement('option');
            option.value = unit.id;
            option.textContent = `${unit.id} (${unit.side})`;
            targetSelect.appendChild(option);
        }
    });
}

function formatEvent(event) {
    const ts = (event.ts_ms / 1000).toFixed(1);
    let msg = `[${ts}s] ${event.kind}`;

    switch (event.kind) {
        case 'UnitMoved':
            msg += `: ${event.data.unit_id} -> ${Math.round(event.data.pos_m)}m`;
            break;
        case 'Contact':
            msg += `: ${event.data.unit_id} detected ${event.data.target_id}`;
            break;
        case 'ShotFired':
            msg += `: ${event.data.shooter} -> ${event.data.target} (${Math.round(event.data.dist_m)}m, ${(event.data.p * 100).toFixed(0)}%)`;
            break;
        case 'Damage':
            msg += `: ${event.data.target} took ${event.data.dmg.toFixed(1)} damage (HP: ${event.data.hp.toFixed(1)})`;
            break;
        case 'Destroyed':
            msg += `: ${event.data.unit_id} DESTROYED`;
            break;
        case 'Routed':
            msg += `: ${event.data.unit_id} ROUTED`;
            break;
        case 'OrderAccepted':
            msg += `: ${event.data.unit_id} - ${event.data.kind}`;
            break;
        default:
            msg += `: ${JSON.stringify(event.data)}`;
    }

    return msg;
}

function getEventClass(kind) {
    const classMap = {
        'Damage': 'damage',
        'Destroyed': 'destroyed',
        'Routed': 'routed',
        'ShotFired': 'combat',
        'Contact': 'contact',
        'OrderAccepted': 'order'
    };
    return classMap[kind] || 'info';
}

function addEventToLog(message, className = 'info') {
    const eventLog = document.getElementById('eventLog');
    const eventDiv = document.createElement('div');
    eventDiv.className = `event ${className}`;
    eventDiv.textContent = message;
    eventLog.insertBefore(eventDiv, eventLog.firstChild);

    // Limit to 100 events
    while (eventLog.children.length > 100) {
        eventLog.removeChild(eventLog.lastChild);
    }
}

function clearEventLog() {
    document.getElementById('eventLog').innerHTML = '';
}

function startPolling() {
    // Update state and events every 500ms
    updateInterval = setInterval(() => {
        fetchState();
        fetchEvents();
    }, 500);
}

async function setTimeCompression(speed) {
    try {
        const response = await fetch(`/battle/local/time-control?time_compression=${speed}`, {
            method: 'POST'
        });

        if (response.ok) {
            const data = await response.json();
            const actualSpeed = data.time_compression;

            // Update UI
            document.getElementById('currentSpeed').textContent =
                actualSpeed < 1 ? (actualSpeed === 0.1 ? 'Paused' : `${actualSpeed}x`) : `${actualSpeed}x`;

            // Update active button
            document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('active'));
            if (actualSpeed === 0.1) {
                document.getElementById('pauseBtn').classList.add('active');
            } else if (actualSpeed === 0.5) {
                document.getElementById('slowBtn').classList.add('active');
            } else if (actualSpeed === 1.0) {
                document.getElementById('normalBtn').classList.add('active');
            } else if (actualSpeed === 30.0) {
                document.getElementById('fastBtn').classList.add('active');
            } else if (actualSpeed === 100.0) {
                document.getElementById('veryFastBtn').classList.add('active');
            }

            addEventToLog(`Time compression set to ${actualSpeed}x`, 'system');
        }
    } catch (error) {
        console.error('Error setting time compression:', error);
        addEventToLog('Error setting time compression', 'error');
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (updateInterval) clearInterval(updateInterval);
});
