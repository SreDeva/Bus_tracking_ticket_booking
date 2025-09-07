from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import random
import string
import uuid
import math
from typing import List, Optional
from geopy.distance import geodesic

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas import User
from ..models.user import Route, RouteStop, Bus, GPSTracking
from pydantic import BaseModel

router = APIRouter(prefix="/passenger", tags=["passenger"])

# Pydantic models
class LocationInput(BaseModel):
    latitude: float
    longitude: float

class RouteSearchRequest(BaseModel):
    source_stop_name: str
    destination_stop_name: str
    user_location: Optional[LocationInput] = None
    max_distance_km: float = 3.0

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
    current_latitude: float
    current_longitude: float
    distance_from_user_km: float
    estimated_arrival_minutes: int
    route_id: int
    route_name: str
    next_stop: str
    stops_remaining: int

class TicketBookingRequest(BaseModel):
    bus_id: int
    source_stop: str
    destination_stop: str
    passenger_id: Optional[int] = None

class Ticket(BaseModel):
    id: int
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

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points using geopy geodesic (more accurate)"""
    point1 = (lat1, lon1)
    point2 = (lat2, lon2)
    distance = geodesic(point1, point2).kilometers
    return distance

def calculate_eta_minutes(distance_km: float, bus_speed_kmh: float = 40) -> int:
    """Calculate estimated arrival time based on distance and average bus speed"""
    # Average bus speed in city traffic (40 km/h)
    # Add buffer time for stops and traffic
    travel_time_hours = distance_km / bus_speed_kmh
    travel_time_minutes = travel_time_hours * 60
    
    # Add 2 minutes buffer for every kilometer (stops, traffic lights, etc.)
    buffer_minutes = distance_km * 2
    
    total_eta = travel_time_minutes + buffer_minutes
    return max(5, int(total_eta))  # Minimum 5 minutes ETA

def find_stop_by_name(db: Session, stop_name: str) -> Optional[RouteStop]:
    """Find bus stop by name with fuzzy matching"""
    stop_name_lower = stop_name.lower().strip()
    
    # Try exact match first
    stop = db.query(RouteStop).filter(RouteStop.stop_name.ilike(f"%{stop_name_lower}%")).first()
    if stop:
        return stop
    
    # Try partial match
    all_stops = db.query(RouteStop).all()
    for stop in all_stops:
        if stop.stop_name and stop_name_lower in stop.stop_name.lower():
            return stop
        # Also try reverse match
        if stop.stop_name and any(word in stop.stop_name.lower() for word in stop_name_lower.split()):
            return stop
    
    return None

def get_all_bus_stops(db: Session) -> List[dict]:
    """Get all bus stops from database"""
    stops = db.query(RouteStop).all()
    return [
        {
            "id": stop.id,
            "name": stop.stop_name,
            "latitude": float(stop.latitude) if stop.latitude else 0.0,
            "longitude": float(stop.longitude) if stop.longitude else 0.0,
            "stop_order": stop.stop_order or 1
        }
        for stop in stops if stop.latitude and stop.longitude
    ]

@router.post("/find-route")
async def find_bus_route(
    request: RouteSearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Find buses and routes between source and destination stop names"""
    try:
        print(f"Searching for routes with source: '{request.source_stop_name}' and destination: '{request.destination_stop_name}'")
        
        # Find routes that contain both source and destination stops
        source_routes = db.query(RouteStop.route_id).filter(
            RouteStop.stop_name.ilike(f"%{request.source_stop_name}%")
        ).subquery()
        
        destination_routes = db.query(RouteStop.route_id).filter(
            RouteStop.stop_name.ilike(f"%{request.destination_stop_name}%")
        ).subquery()
        
        # Find routes that contain both stops
        valid_route_ids = db.query(source_routes.c.route_id).intersect(
            db.query(destination_routes.c.route_id)
        ).all()
        
        valid_route_ids = [route_id[0] for route_id in valid_route_ids]
        print(f"Found valid route IDs: {valid_route_ids}")
        
        if not valid_route_ids:
            print("No routes found connecting source and destination")
            raise HTTPException(status_code=404, detail="No routes found between these stops")
        
        # Get the actual stop details
        source_stop = db.query(RouteStop).filter(
            RouteStop.stop_name.ilike(f"%{request.source_stop_name}%")
        ).first()
        
        destination_stop = db.query(RouteStop).filter(
            RouteStop.stop_name.ilike(f"%{request.destination_stop_name}%")
        ).first()
        
        if not source_stop:
            raise HTTPException(status_code=404, detail=f"Source stop '{request.source_stop_name}' not found")
        
        if not destination_stop:
            raise HTTPException(status_code=404, detail=f"Destination stop '{request.destination_stop_name}' not found")
        
        # Get buses that serve the valid routes
        available_buses = []
        
        for route_id in valid_route_ids:
            # Get the route information
            route = db.query(Route).filter(Route.id == route_id).first()
            if not route:
                continue
                
            # Get the bus information
            bus_info = db.query(Bus).filter(Bus.id == route.bus_id).first()
            if not bus_info:
                continue
                
            # Get latest GPS tracking data for this bus
            bus_gps = db.query(GPSTracking).filter(
                GPSTracking.bus_id == route.bus_id,
                GPSTracking.route_id == route_id
            ).order_by(GPSTracking.timestamp.desc()).first()
            
            if bus_gps:
                # Calculate distance from search location (user or source stop)
                search_lat = request.user_location.latitude if request.user_location else source_stop.latitude
                search_lng = request.user_location.longitude if request.user_location else source_stop.longitude
                
                bus_distance = calculate_distance(
                    search_lat, search_lng,
                    bus_gps.latitude, bus_gps.longitude
                )
                
                if bus_distance <= request.max_distance_km:
                    eta_minutes = calculate_eta_minutes(bus_distance)
                    available_buses.append({
                        "bus_id": route.bus_id,
                        "bus_number": bus_info.bus_number,
                        "current_latitude": float(bus_gps.latitude),
                        "current_longitude": float(bus_gps.longitude),
                        "distance_from_user_km": round(bus_distance, 2),
                        "estimated_arrival_minutes": eta_minutes,
                        "route_id": route_id,
                        "route_name": route.route_name,
                        "next_stop": destination_stop.stop_name,
                        "stops_remaining": 2,
                        "bus_type": bus_info.bus_type,
                        "capacity": bus_info.capacity
                    })
                    print(f"Added bus {bus_info.bus_number} from route {route.route_name}")
        
        # If no buses found on valid routes, don't show any buses
        if not available_buses:
            print("No buses found on valid routes within distance")
            raise HTTPException(status_code=404, detail="No buses found on routes between these stops")
        
        # Sort buses by distance
        available_buses.sort(key=lambda x: x["distance_from_user_km"])
        
        # Select recommended bus (closest one)
        recommended_bus = available_buses[0] if available_buses else None
        
        # Get actual route geometry using OpenRouteService
        from ..services.map_service import map_service
        
        # Calculate route using OpenRouteService
        coordinates = [
            [source_stop.latitude, source_stop.longitude],
            [destination_stop.latitude, destination_stop.longitude]
        ]
        
        route_data = map_service.calculate_route(coordinates)
        
        # Extract route geometry and distance from OpenRouteService response
        if route_data and route_data.get('features') and len(route_data['features']) > 0:
            feature = route_data['features'][0]
            route_geometry = feature.get('geometry', {})
            
            # Get distance from OpenRouteService (in meters)
            properties = feature.get('properties', {})
            if 'segments' in properties and len(properties['segments']) > 0:
                total_distance_km = properties['segments'][0].get('distance', 0) / 1000.0
                estimated_duration_minutes = int(properties['segments'][0].get('duration', 0) / 60.0)
            else:
                # Fallback to calculated distance
                total_distance_km = calculate_distance(
                    source_stop.latitude, source_stop.longitude,
                    destination_stop.latitude, destination_stop.longitude
                )
                estimated_duration_minutes = int(total_distance_km * 2)  # 2 minutes per km average
        else:
            # Fallback to straight line if OpenRouteService fails
            print("OpenRouteService failed, using straight line fallback")
            total_distance_km = calculate_distance(
                source_stop.latitude, source_stop.longitude,
                destination_stop.latitude, destination_stop.longitude
            )
            estimated_duration_minutes = int(total_distance_km * 2)  # 2 minutes per km average
            
            route_geometry = {
                "type": "LineString",
                "coordinates": [
                    [source_stop.longitude, source_stop.latitude],
                    [destination_stop.longitude, destination_stop.latitude]
                ]
            }
        
        return {
            "source_stop": {
                "id": source_stop.id,
                "name": source_stop.stop_name,
                "latitude": source_stop.latitude,
                "longitude": source_stop.longitude,
                "stop_order": source_stop.stop_order
            },
            "destination_stop": {
                "id": destination_stop.id,
                "name": destination_stop.stop_name,
                "latitude": destination_stop.latitude,
                "longitude": destination_stop.longitude,
                "stop_order": destination_stop.stop_order
            },
            "buses_on_route": available_buses,
            "route_geometry": route_geometry,
            "total_distance_km": round(total_distance_km, 2),
            "estimated_duration_minutes": estimated_duration_minutes,
            "recommended_bus": recommended_bus
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error finding route: {str(e)}"
        )
@router.get("/bus-stops")
async def get_bus_stops(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all bus stops, optionally sorted by distance from user location"""
    try:
        stops = []
        all_stops = get_all_bus_stops(db)
        
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

@router.post("/book-ticket")
async def book_ticket(
    request: TicketBookingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Book a ticket for a specific bus"""
    try:
        # Get bus information from database
        bus_info = db.query(Bus).filter(Bus.id == request.bus_id).first()
        if not bus_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bus with ID {request.bus_id} not found"
            )
        
        # Generate ticket details
        ticket_id = random.randint(1000, 9999)
        qr_code = f"QR{ticket_id}{random.randint(100, 999)}"
        one_time_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        
        # Create ticket with real bus number
        ticket = Ticket(
            id=ticket_id,
            bus_id=request.bus_id,
            bus_number=bus_info.bus_number,  # Use real bus number from database
            route_name=f"{request.source_stop} to {request.destination_stop}",
            source_stop=request.source_stop,
            destination_stop=request.destination_stop,
            qr_code=qr_code,
            one_time_code=one_time_code,
            expires_at=(datetime.now() + timedelta(hours=24)).isoformat(),
            status="active",
            created_at=datetime.now().isoformat()
        )
        
        return ticket
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error booking ticket: {str(e)}"
        )

@router.get("/nearby-buses")
async def get_nearby_buses(
    latitude: float,
    longitude: float,
    max_distance_km: float = 3.0,  # Changed from radius_km to match frontend
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get buses within specified radius of user location"""
    try:
        nearby_buses = []
        
        # Get GPS tracking data with bus information using JOIN
        active_buses_query = db.query(GPSTracking, Bus).join(
            Bus, GPSTracking.bus_id == Bus.id
        ).filter(GPSTracking.is_active == True).all()
        
        for bus_gps, bus_info in active_buses_query:
            distance = calculate_distance(
                latitude, longitude,
                float(bus_gps.latitude), float(bus_gps.longitude)
            )
            
            if distance <= max_distance_km:  # Use max_distance_km instead of radius_km
                eta_minutes = calculate_eta_minutes(distance)
                nearby_buses.append({
                    "bus_id": bus_gps.bus_id,
                    "bus_number": bus_info.bus_number,  # Use real bus number from database
                    "current_latitude": float(bus_gps.latitude),
                    "current_longitude": float(bus_gps.longitude),
                    "distance_from_user_km": round(distance, 2),
                    "estimated_arrival_minutes": eta_minutes,
                    "bus_type": bus_info.bus_type,
                    "capacity": bus_info.capacity,
                    "route_id": bus_gps.route_id,
                    "last_updated": bus_gps.timestamp.isoformat() if bus_gps.timestamp else None
                })
        
        nearby_buses.sort(key=lambda x: x["distance_from_user_km"])
        return nearby_buses
        
    except Exception as e:
        print(f"Error in get_nearby_buses: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching nearby buses: {str(e)}"
        )
