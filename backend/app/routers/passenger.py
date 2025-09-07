from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import random
import string
import uuid
import math
from typing import List, Optional

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas import User
from ..models.user import Route, RouteStop, Bus, GPSTracking
from pydantic import BaseModel

router = APIRouter(prefix="/passenger", tags=["passenger"])

# Pydantic models for passenger booking
class LocationInput(BaseModel):
    latitude: float
    longitude: float

class RouteSearchRequest(BaseModel):
    source_location: Optional[LocationInput] = None
    source_stop_id: Optional[int] = None
    destination_stop_id: int
    max_distance_km: Optional[float] = 3.0

class BusStop(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    stop_order: int
    distance_km: Optional[float] = None

class BusOnRoute(BaseModel):
    bus_id: int
    bus_number: str
    current_latitude: Optional[float]
    current_longitude: Optional[float]
    distance_from_user_km: Optional[float]
    estimated_arrival_minutes: Optional[int]
    route_id: int
    route_name: str
    next_stop: Optional[str]
    stops_remaining: Optional[int]

class RouteVisualization(BaseModel):
    source_stop: BusStop
    destination_stop: BusStop
    buses_on_route: List[BusOnRoute]
    route_geometry: Optional[dict] = None
    total_distance_km: float
    estimated_duration_minutes: int
    recommended_bus: Optional[BusOnRoute] = None

class TicketBookingRequest(BaseModel):
    bus_id: int
    source_stop_id: int
    destination_stop_id: int

class TicketResponse(BaseModel):
    id: str
    bus_id: int
    bus_number: str
    route_name: str
    source_stop: str
    destination_stop: str
    qr_code: str
    one_time_code: str
    expires_at: str
    status: str
    created_at: str
    fare: float

# Database query functions
def fetch_all_bus_stops(db: Session) -> List[dict]:
    """Get all bus stops from database"""
    stops = db.query(RouteStop).all()
    return [
        {
            "id": stop.id,
            "name": stop.stop_name,  # Fixed: use stop_name instead of name
            "latitude": float(stop.latitude) if stop.latitude else 0.0,
            "longitude": float(stop.longitude) if stop.longitude else 0.0,
            "stop_order": stop.stop_order
        }
        for stop in stops if stop.latitude and stop.longitude  # Only include stops with coordinates
    ]

def get_routes_with_stops(db: Session) -> List[dict]:
    """Get all routes with their stops from database"""
    routes = db.query(Route).filter(Route.is_active == True).all()
    result = []
    
    for route in routes:
        # Get all stops for this route
        stops = db.query(RouteStop).filter(RouteStop.route_id == route.id).order_by(RouteStop.stop_order).all()
        
        # Get bus information
        bus = db.query(Bus).filter(Bus.id == route.bus_id).first()
        if not bus:
            continue
            
        # Get current location from GPS tracking or use first stop location
        current_location = {"lat": 0.0, "lng": 0.0}
        
        # Try to get latest GPS location for this bus
        latest_gps = db.query(GPSTracking).filter(
            GPSTracking.bus_id == route.bus_id
        ).order_by(GPSTracking.timestamp.desc()).first()
        
        if latest_gps:
            current_location = {
                "lat": float(latest_gps.latitude),
                "lng": float(latest_gps.longitude)
            }
        elif stops and stops[0].latitude and stops[0].longitude:
            # Fallback to first stop location
            current_location = {
                "lat": float(stops[0].latitude),
                "lng": float(stops[0].longitude)
            }
        
        route_data = {
            "id": route.id,
            "name": route.route_name,
            "bus_id": route.bus_id,
            "bus_number": bus.bus_number,
            "stops": [stop.id for stop in stops],
            "current_location": current_location,
            "origin": route.origin,
            "destination": route.destination,
            "distance_km": route.distance_km,
            "is_active": route.is_active
        }
        result.append(route_data)
    
    return result

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates using Haversine formula"""
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def find_closest_bus_stop(user_lat: float, user_lng: float, db: Session) -> BusStop:
    """Find the closest bus stop to user's location"""
    all_stops = fetch_all_bus_stops(db)  # Updated function name
    closest_stop = None
    min_distance = float('inf')
    
    for stop in all_stops:
        distance = calculate_distance(user_lat, user_lng, stop["latitude"], stop["longitude"])
        if distance < min_distance:
            min_distance = distance
            closest_stop = stop
    
    if closest_stop:
        return BusStop(
            id=closest_stop["id"],
            name=closest_stop["name"],
            latitude=closest_stop["latitude"],
            longitude=closest_stop["longitude"],
            stop_order=closest_stop["stop_order"],
            distance_km=min_distance
        )
    raise HTTPException(status_code=404, detail="No bus stops found")

def find_buses_within_radius(user_lat: float, user_lng: float, max_distance_km: float, db: Session) -> List[BusOnRoute]:
    """Find all buses within specified radius of user location"""
    nearby_buses = []
    all_routes = get_routes_with_stops(db)
    
    for route in all_routes:
        bus_lat = route["current_location"]["lat"]
        bus_lng = route["current_location"]["lng"]
        distance = calculate_distance(user_lat, user_lng, bus_lat, bus_lng)
        
        if distance <= max_distance_km:
            # Calculate estimated arrival (mock calculation)
            estimated_arrival = max(1, int(distance * 10))  # Rough estimate: 10 minutes per km
            
            bus = BusOnRoute(
                bus_id=route["bus_id"],
                bus_number=route["bus_number"],
                current_latitude=bus_lat,
                current_longitude=bus_lng,
                distance_from_user_km=distance,
                estimated_arrival_minutes=estimated_arrival,
                route_id=route["id"],
                route_name=route["name"],
                next_stop=f"Stop {route['stops'][0]}",
                stops_remaining=len(route["stops"])
            )
            nearby_buses.append(bus)
    
    # Sort by distance
    nearby_buses.sort(key=lambda x: x.distance_from_user_km or float('inf'))
    return nearby_buses

@router.post("/search-routes", response_model=RouteVisualization)
async def search_routes(
    search_request: RouteSearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Search for routes and buses based on source and destination.
    If source_location is provided without source_stop_id, find closest stop.
    """
    try:
        # Determine source stop
        if search_request.source_stop_id:
            # Use provided source stop
            source_stop_obj = db.query(RouteStop).filter(RouteStop.id == search_request.source_stop_id).first()
            if not source_stop_obj:
                raise HTTPException(status_code=404, detail="Source stop not found")
            source_stop = BusStop(
                id=source_stop_obj.id,
                name=source_stop_obj.stop_name,  # Fixed: use stop_name
                latitude=float(source_stop_obj.latitude) if source_stop_obj.latitude else 0.0,
                longitude=float(source_stop_obj.longitude) if source_stop_obj.longitude else 0.0,
                stop_order=source_stop_obj.stop_order
            )
        elif search_request.source_location:
            # Find closest stop to user's location
            source_stop = find_closest_bus_stop(
                search_request.source_location.latitude,
                search_request.source_location.longitude,
                db
            )
        else:
            raise HTTPException(status_code=400, detail="Either source_stop_id or source_location must be provided")
        
        # Get destination stop
        destination_stop_obj = db.query(RouteStop).filter(RouteStop.id == search_request.destination_stop_id).first()
        if not destination_stop_obj:
            raise HTTPException(status_code=404, detail="Destination stop not found")
        destination_stop = BusStop(
            id=destination_stop_obj.id,
            name=destination_stop_obj.stop_name,  # Fixed: use stop_name
            latitude=float(destination_stop_obj.latitude) if destination_stop_obj.latitude else 0.0,
            longitude=float(destination_stop_obj.longitude) if destination_stop_obj.longitude else 0.0,
            stop_order=destination_stop_obj.stop_order
        )
        
        # Find routes that connect source and destination
        connecting_routes = []
        all_routes = get_routes_with_stops(db)
        for route in all_routes:
            if source_stop.id in route["stops"] and destination_stop.id in route["stops"]:
                # Check if source comes before destination in the route
                source_index = route["stops"].index(source_stop.id)
                dest_index = route["stops"].index(destination_stop.id)
                
                if source_index < dest_index:
                    bus_lat = route["current_location"]["lat"]
                    bus_lng = route["current_location"]["lng"]
                    
                    # Calculate distance from user (if location provided)
                    distance_from_user = None
                    if search_request.source_location:
                        distance_from_user = calculate_distance(
                            search_request.source_location.latitude,
                            search_request.source_location.longitude,
                            bus_lat, bus_lng
                        )
                    
                    estimated_arrival = 5 + random.randint(1, 15)  # Mock calculation
                    stops_remaining = dest_index - source_index
                    
                    bus = BusOnRoute(
                        bus_id=route["bus_id"],
                        bus_number=route["bus_number"],
                        current_latitude=bus_lat,
                        current_longitude=bus_lng,
                        distance_from_user_km=distance_from_user,
                        estimated_arrival_minutes=estimated_arrival,
                        route_id=route["id"],
                        route_name=route["name"],
                        next_stop=f"Stop {route['stops'][source_index]}",
                        stops_remaining=stops_remaining
                    )
                    connecting_routes.append(bus)
        
        if not connecting_routes:
            raise HTTPException(status_code=404, detail="No routes found connecting source and destination")
        
        # Sort by distance from user (if available) or estimated arrival
        connecting_routes.sort(key=lambda x: x.distance_from_user_km or x.estimated_arrival_minutes or float('inf'))
        
        # Calculate route distance and duration
        route_distance = calculate_distance(
            source_stop.latitude, source_stop.longitude,
            destination_stop.latitude, destination_stop.longitude
        )
        estimated_duration = max(10, int(route_distance * 15))  # Rough estimate
        
        # Mock route geometry (simplified line)
        route_geometry = {
            "type": "LineString",
            "coordinates": [
                [source_stop.longitude, source_stop.latitude],
                [destination_stop.longitude, destination_stop.latitude]
            ]
        }
        
        return RouteVisualization(
            source_stop=source_stop,
            destination_stop=destination_stop,
            buses_on_route=connecting_routes,
            route_geometry=route_geometry,
            total_distance_km=route_distance,
            estimated_duration_minutes=estimated_duration,
            recommended_bus=connecting_routes[0] if connecting_routes else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error searching routes: {str(e)}"
        )

@router.get("/nearby-buses")
async def get_nearby_buses(
    latitude: float,
    longitude: float,
    max_distance_km: float = 3.0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)  # Added missing db dependency
):
    """Get all buses within specified distance from user's location"""
    try:
        nearby_buses = find_buses_within_radius(latitude, longitude, max_distance_km, db)  # Added db parameter
        
        return {
            "user_location": {"latitude": latitude, "longitude": longitude},
            "search_radius_km": max_distance_km,
            "buses_found": len(nearby_buses),
            "buses": nearby_buses,
            "closest_bus": nearby_buses[0] if nearby_buses else None
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error finding nearby buses: {str(e)}"
        )

@router.post("/book-ticket", response_model=TicketResponse)
async def book_ticket(
    booking_request: TicketBookingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Book a ticket for selected bus and route"""
    try:
        # Find the bus and route info from database
        all_routes = get_routes_with_stops(db)
        route = next((r for r in all_routes if r["bus_id"] == booking_request.bus_id), None)
        if not route:
            raise HTTPException(status_code=404, detail="Bus not found")
        
        # Get stop information from database
        source_stop_obj = db.query(RouteStop).filter(RouteStop.id == booking_request.source_stop_id).first()
        dest_stop_obj = db.query(RouteStop).filter(RouteStop.id == booking_request.destination_stop_id).first()
        
        if not source_stop_obj or not dest_stop_obj:
            raise HTTPException(status_code=404, detail="Stop not found")
        
        # Generate ticket
        ticket_id = str(uuid.uuid4())
        qr_code = f"QR{datetime.now().strftime('%Y%m%d%H%M%S')}{random.randint(1000, 9999)}"
        one_time_code = str(random.randint(1000, 9999))
        
        # Calculate fare based on distance
        distance = calculate_distance(
            float(source_stop_obj.latitude), float(source_stop_obj.longitude),
            float(dest_stop_obj.latitude), float(dest_stop_obj.longitude)
        )
        base_fare = 10.0
        fare = base_fare + (distance * 5.0)  # 5 rupees per km
        
        expires_at = datetime.now() + timedelta(hours=1)
        
        ticket = TicketResponse(
            id=ticket_id,
            bus_id=booking_request.bus_id,
            bus_number=route["bus_number"],
            route_name=route["name"],
            source_stop=source_stop_obj.stop_name,  # Fixed: use stop_name
            destination_stop=dest_stop_obj.stop_name,  # Fixed: use stop_name
            qr_code=qr_code,
            one_time_code=one_time_code,
            expires_at=expires_at.isoformat(),
            status="active",
            created_at=datetime.now().isoformat(),
            fare=round(fare, 2)
        )
        
        return ticket
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error booking ticket: {str(e)}"
        )

@router.get("/bus-stops")
async def get_all_bus_stops(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all bus stops, optionally sorted by distance from user location"""
    try:
        stops = []
        all_stops = fetch_all_bus_stops(db)  # Updated function name
        
        for stop_data in all_stops:
            distance = None
            if latitude is not None and longitude is not None:
                distance = calculate_distance(latitude, longitude, stop_data["latitude"], stop_data["longitude"])
            
            stop = BusStop(
                id=stop_data["id"],
                name=stop_data["name"],
                latitude=stop_data["latitude"],
                longitude=stop_data["longitude"],
                stop_order=stop_data["stop_order"],
                distance_km=distance
            )
            stops.append(stop)
        
        # Sort by distance if location provided
        if latitude is not None and longitude is not None:
            stops.sort(key=lambda x: x.distance_km or float('inf'))
        
        return stops
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching bus stops: {str(e)}"
        )
