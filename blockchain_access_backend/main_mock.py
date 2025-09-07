# main.py
import os
import json
from typing import List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Query
import time

app = FastAPI(title="DriverAssignmentTracker API (Mock)")

# Pydantic models
class AssignmentIn(BaseModel):
    busId: str
    source: str
    destination: str
    driverId: str
    timestamp: int

class TxResponse(BaseModel):
    tx_hash: str
    status: Optional[str] = "0x1"
    contract_address: Optional[str] = None

# In-memory storage for testing
assignments_db = []
events_db = []

def generate_mock_tx_hash():
    """Generate a mock transaction hash"""
    return f"0x{''.join([hex(int(time.time() * 1000000) % 16)[2:] for _ in range(64)])}"

# Endpoints

@app.post("/assignments", response_model=TxResponse)
def create_assignment(payload: AssignmentIn, wait_for_receipt: bool = Query(True, description="Wait for tx receipt (true/false)")):
    """
    Record assignment (mock blockchain implementation)
    """
    try:
        # Store in memory
        assignment_id = len(assignments_db) + 1
        assignment_data = {
            "id": assignment_id,
            "busId": payload.busId,
            "source": payload.source,
            "destination": payload.destination,
            "driverId": payload.driverId,
            "timestamp": payload.timestamp
        }
        assignments_db.append(assignment_data)
        
        # Mock event
        event_data = {
            "id": assignment_id,
            "busId": payload.busId,
            "driverId": payload.driverId,
            "timestamp": payload.timestamp,
            "blockNumber": 12345 + assignment_id,
            "txHash": generate_mock_tx_hash()
        }
        events_db.append(event_data)
        
        return TxResponse(
            tx_hash=event_data["txHash"],
            status="0x1",
            contract_address="0x1234567890123456789012345678901234567890"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/bus/{busId}/drivers")
def get_drivers_by_bus(busId: str):
    try:
        results = [a for a in assignments_db if a["busId"] == busId]
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/driver/{driverId}/buses")
def get_buses_by_driver(driverId: str):
    try:
        results = [a for a in assignments_db if a["driverId"] == driverId]
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/assignments/bus/{busId}/driver/{driverId}")
def get_assignments_by_bus_driver(busId: str, driverId: str):
    try:
        results = [a for a in assignments_db if a["busId"] == busId and a["driverId"] == driverId]
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/bus/{busId}/time/{timestamp}")
def get_driver_by_bus_time(busId: str, timestamp: int):
    try:
        results = [a for a in assignments_db if a["busId"] == busId and abs(a["timestamp"] - timestamp) < 3600]
        return results[0] if results else None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/driver/{driverId}/time/{timestamp}")
def get_bus_by_driver_time(driverId: str, timestamp: int):
    try:
        results = [a for a in assignments_db if a["driverId"] == driverId and abs(a["timestamp"] - timestamp) < 3600]
        return results[0] if results else None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/events/assignments")
def get_assignment_events(from_block: Optional[int] = None, to_block: Optional[int] = None):
    try:
        return events_db
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Health check
@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Mock blockchain API running"}

# Run:
# uvicorn main:app --reload --host 0.0.0.0 --port 8001
