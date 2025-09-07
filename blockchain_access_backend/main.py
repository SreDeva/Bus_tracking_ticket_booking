# main.py
import os
import json
from typing import List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Query
from web3 import Web3
from web3.exceptions import ContractLogicError
from dotenv import load_dotenv

load_dotenv()  # loads .env in working directory

# --- Environment ---
RPC_URL = os.getenv("RPC_URL")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")
ACCOUNT_ADDRESS = os.getenv("ACCOUNT_ADDRESS")
PRIVATE_KEY = os.getenv("PRIVATE_KEY")

if not RPC_URL:
    raise RuntimeError("RPC_URL must be set in environment variables (e.g. https://primordial-rpc.example)")

# ---- Init web3 ----
w3 = Web3(Web3.HTTPProvider(RPC_URL))

if not w3.is_connected():
    raise RuntimeError(f"Could not connect to RPC at {RPC_URL}")

# Validate contract address
if not CONTRACT_ADDRESS:
    raise RuntimeError("CONTRACT_ADDRESS must be set in environment variables")

if not Web3.is_address(CONTRACT_ADDRESS):
    raise RuntimeError(f"CONTRACT_ADDRESS {CONTRACT_ADDRESS} is not a valid address")

CONTRACT_ADDRESS_CHECKSUM = Web3.to_checksum_address(CONTRACT_ADDRESS)

# Load ABI from file
ABI_PATH = os.path.join(os.path.dirname(__file__), "abi.json")
if not os.path.exists(ABI_PATH):
    raise RuntimeError(f"ABI file not found at {ABI_PATH}. Please create abi.json")

with open(ABI_PATH, "r", encoding="utf-8") as f:
    ABI = json.load(f)

contract = w3.eth.contract(address=CONTRACT_ADDRESS_CHECKSUM, abi=ABI)

# Optional: checksum account address if provided
ACCOUNT_ADDRESS_CHECKSUM = None
if ACCOUNT_ADDRESS:
    if not Web3.is_address(ACCOUNT_ADDRESS):
        raise RuntimeError("ACCOUNT_ADDRESS is not a valid address")
    ACCOUNT_ADDRESS_CHECKSUM = Web3.to_checksum_address(ACCOUNT_ADDRESS)

app = FastAPI(title="DriverAssignmentTracker API (fixed)")

# Pydantic models
class AssignmentIn(BaseModel):
    busId: str
    source: str
    destination: str
    driverId: str
    timestamp: int

class TxResponse(BaseModel):
    tx_hash: str
    status: Optional[str] = None
    contract_address: Optional[str] = None

# Helpers
def tuple_to_assignment(tup):
    if tup is None:
        return None
    # tuple layout: (busId, source, destination, driverId, timestamp)
    return {
        "busId": tup[0],
        "source": tup[1],
        "destination": tup[2],
        "driverId": tup[3],
        "timestamp": int(tup[4])
    }

def tuples_to_assignments(tuples):
    return [tuple_to_assignment(t) for t in tuples]

# Endpoints

@app.post("/assignments", response_model=TxResponse)
def create_assignment(payload: AssignmentIn, wait_for_receipt: bool = Query(True, description="Wait for tx receipt (true/false)")):
    """
    Record assignment on chain by sending a signed transaction.
    Set wait_for_receipt=false to return immediately with tx hash.
    """
    if not ACCOUNT_ADDRESS_CHECKSUM or not PRIVATE_KEY:
        raise HTTPException(status_code=500, detail="ACCOUNT_ADDRESS and PRIVATE_KEY must be set to send transactions.")

    try:
        fn = contract.functions.recordAssignment(
            payload.busId,
            payload.source,
            payload.destination,
            payload.driverId,
            payload.timestamp
        )

        # Estimate gas (use fallback if estimate fails)
        try:
            gas_estimate = fn.estimate_gas({"from": ACCOUNT_ADDRESS_CHECKSUM})
        except Exception:
            gas_estimate = 300_000

        # Nonce
        nonce = w3.eth.get_transaction_count(ACCOUNT_ADDRESS_CHECKSUM, "pending")

        # Build tx
        tx = fn.build_transaction({
            "from": ACCOUNT_ADDRESS_CHECKSUM,
            "nonce": nonce,
            "gas": gas_estimate,
            "gasPrice": w3.eth.gas_price,
            "chainId": 1043
        })

        # Sign
        signed = w3.eth.account.sign_transaction(tx, private_key=PRIVATE_KEY)

        # Send
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        tx_hash_hex = tx_hash.hex()

        if not wait_for_receipt:
            return TxResponse(tx_hash=tx_hash_hex)

        # Wait for receipt
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
        status = None
        contract_address = None
        if receipt:
            # receipt.status is 1 or 0 as integer
            status = hex(receipt.status) if receipt.status is not None else None
            contract_address = receipt.contractAddress
        return TxResponse(tx_hash=tx_hash_hex, status=status, contract_address=contract_address)

    except ContractLogicError as e:
        raise HTTPException(status_code=400, detail=f"Contract revert: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/bus/{busId}/drivers")
def get_drivers_by_bus(busId: str):
    try:
        raw = contract.functions.getDriversByBus(busId).call()
        return tuples_to_assignments(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/driver/{driverId}/buses")
def get_buses_by_driver(driverId: str):
    try:
        raw = contract.functions.getBusesByDriver(driverId).call()
        return tuples_to_assignments(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/assignments/bus/{busId}/driver/{driverId}")
def get_assignments_by_bus_driver(busId: str, driverId: str):
    try:
        raw = contract.functions.getAssignmentsByBusDriver(busId, driverId).call()
        return tuples_to_assignments(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/bus/{busId}/time/{timestamp}")
def get_driver_by_bus_time(busId: str, timestamp: int):
    try:
        raw = contract.functions.getDriverByBusTime(busId, timestamp).call()
        # Could be zero-value struct -> caller should handle if result seems empty
        return tuple_to_assignment(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/driver/{driverId}/time/{timestamp}")
def get_bus_by_driver_time(driverId: str, timestamp: int):
    try:
        raw = contract.functions.getBusByDriverTime(driverId, timestamp).call()
        return tuple_to_assignment(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/events/assignments")
def get_assignment_events(from_block: Optional[int] = None, to_block: Optional[int] = None):
    try:
        if from_block is None:
            from_block = 0
        if to_block is None:
            to_block = w3.eth.block_number

        # Create filter
        event_filter = contract.events.AssignmentRecorded.create_filter(from_block=from_block, to_block=to_block)
        entries = event_filter.get_all_entries()
        results = []
        for ev in entries:
            results.append({
                "id": int(ev.args.id),
                "busId": ev.args.busId,
                "driverId": ev.args.driverId,
                "timestamp": int(ev.args.timestamp),
                "blockNumber": ev.blockNumber,
                "txHash": ev.transactionHash.hex()
            })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Run:
# uvicorn main:app --reload --host 0.0.0.0 --port 8000
