from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import random
import string
import uuid
from typing import List, Optional

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas import TicketCreate, TicketResponse, User
from ..models.user import Bus, Route, RouteStop  # Import Bus model
from pydantic import BaseModel

router = APIRouter()

# Additional models for ticket operations
class BusSearchRequest(BaseModel):
    source_stop_id: int
    destination_stop_id: int

class AvailableBus(BaseModel):
    id: int
    bus_number: str
    route_name: str
    current_latitude: Optional[float]
    current_longitude: Optional[float]
    estimated_arrival: Optional[str]
    fare: Optional[float]
    expires_at: datetime
    status: str
    created_at: datetime
    user_id: int

class BusSearchRequest(BaseModel):
    source_stop_id: int
    destination_stop_id: int

class AvailableBus(BaseModel):
    id: int
    bus_number: str
    route_name: str
    current_latitude: Optional[float]
    current_longitude: Optional[float]
    estimated_arrival: Optional[str]

# Mock ticket storage (in production, use a proper database)
tickets_storage = {}

def generate_ticket_code():
    """Generate a unique ticket code"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

def generate_one_time_code():
    """Generate a 4-digit one-time use code"""
    return ''.join(random.choices(string.digits, k=4))

@router.post("/search-buses", response_model=List[AvailableBus])
async def search_buses(
    search_request: BusSearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search for available buses between two stops"""
    try:
        # Get source and destination stop information
        source_stop = db.query(RouteStop).filter(RouteStop.id == search_request.source_stop_id).first()
        destination_stop = db.query(RouteStop).filter(RouteStop.id == search_request.destination_stop_id).first()
        
        if not source_stop or not destination_stop:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Source or destination stop not found"
            )
        
        # Get all buses from database
        buses = db.query(Bus).limit(3).all()  # Get first 3 buses for demo
        
        available_buses = []
        for bus in buses:
            available_buses.append(AvailableBus(
                id=bus.id,
                bus_number=bus.bus_number,  # Use real bus number
                route_name=f"{source_stop.stop_name} to {destination_stop.stop_name}",
                current_latitude=source_stop.latitude + (0.01 * bus.id),  # Mock nearby location
                current_longitude=source_stop.longitude + (0.01 * bus.id),
                estimated_arrival=f"{5 + (bus.id * 3)} minutes"  # Mock ETA
            ))
        
        return available_buses
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error searching buses: {str(e)}"
        )

@router.post("/book", response_model=TicketResponse)
async def book_ticket(
    ticket_data: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Book a ticket for the user"""
    try:
        # Generate unique ticket ID
        ticket_id = str(uuid.uuid4())
        
        # Generate codes
        qr_code = f"TICKET_{generate_ticket_code()}"
        one_time_code = generate_one_time_code()
        
        # Set expiration time (1 hour from now)
        expires_at = datetime.now() + timedelta(hours=1)
        
        # Get bus information from database
        bus_info = db.query(Bus).filter(Bus.id == ticket_data.bus_id).first()
        if not bus_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bus with ID {ticket_data.bus_id} not found"
            )
        
        # Get route stops information if available
        source_stop_info = db.query(RouteStop).filter(RouteStop.id == ticket_data.source_stop_id).first()
        destination_stop_info = db.query(RouteStop).filter(RouteStop.id == ticket_data.destination_stop_id).first()
        
        bus_number = bus_info.bus_number
        route_name = f"{source_stop_info.stop_name if source_stop_info else 'Unknown'} to {destination_stop_info.stop_name if destination_stop_info else 'Unknown'}"
        source_stop = source_stop_info.stop_name if source_stop_info else "Unknown Stop"
        destination_stop = destination_stop_info.stop_name if destination_stop_info else "Unknown Stop"
        
        # Create ticket object
        ticket = TicketResponse(
            id=ticket_id,
            bus_id=ticket_data.bus_id,
            bus_number=bus_number,
            route_name=route_name,
            source_stop=source_stop,
            destination_stop=destination_stop,
            qr_code=qr_code,
            one_time_code=one_time_code,
            expires_at=expires_at,
            status="active",
            created_at=datetime.now(),
            user_id=current_user.id
        )
        
        # Store ticket (in production, save to database)
        tickets_storage[ticket_id] = ticket
        
        return ticket
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error booking ticket: {str(e)}"
        )

@router.get("/my-tickets", response_model=List[TicketResponse])
async def get_user_tickets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tickets for the current user"""
    try:
        # Filter tickets for current user
        user_tickets = [
            ticket for ticket in tickets_storage.values() 
            if ticket.user_id == current_user.id
        ]
        
        # Update expired tickets
        current_time = datetime.now()
        for ticket in user_tickets:
            if ticket.expires_at < current_time and ticket.status == "active":
                ticket.status = "expired"
        
        return user_tickets
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching tickets: {str(e)}"
        )

@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific ticket by ID"""
    try:
        if ticket_id not in tickets_storage:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found"
            )
        
        ticket = tickets_storage[ticket_id]
        
        # Check if user owns this ticket
        if ticket.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this ticket"
            )
        
        # Update status if expired
        if ticket.expires_at < datetime.now() and ticket.status == "active":
            ticket.status = "expired"
        
        return ticket
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching ticket: {str(e)}"
        )

@router.post("/{ticket_id}/validate")
async def validate_ticket(
    ticket_id: str,
    validation_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate a ticket using QR code or one-time code"""
    try:
        if ticket_id not in tickets_storage:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found"
            )
        
        ticket = tickets_storage[ticket_id]
        
        # Check if ticket is still valid
        if ticket.expires_at < datetime.now():
            ticket.status = "expired"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ticket has expired"
            )
        
        if ticket.status != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ticket is not active"
            )
        
        # Validate code
        if validation_code != ticket.qr_code and validation_code != ticket.one_time_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid validation code"
            )
        
        # Mark ticket as used
        ticket.status = "used"
        
        return {"message": "Ticket validated successfully", "ticket": ticket}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error validating ticket: {str(e)}"
        )

@router.get("/stops")
async def get_all_stops(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all available bus stops"""
    try:
        # Mock stops for now (in production, query from database)
        stops = [
            {"id": 1, "name": "Main Station", "latitude": 12.9716, "longitude": 77.5946, "stop_order": 1},
            {"id": 2, "name": "City Center", "latitude": 12.9800, "longitude": 77.6000, "stop_order": 2},
            {"id": 3, "name": "Airport", "latitude": 12.9500, "longitude": 77.6500, "stop_order": 3},
            {"id": 4, "name": "Mall Junction", "latitude": 12.9900, "longitude": 77.5800, "stop_order": 4},
            {"id": 5, "name": "Tech Park", "latitude": 12.9600, "longitude": 77.5700, "stop_order": 5},
            {"id": 6, "name": "University", "latitude": 12.9400, "longitude": 77.6200, "stop_order": 6}
        ]
        
        return stops
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching stops: {str(e)}"
        )
