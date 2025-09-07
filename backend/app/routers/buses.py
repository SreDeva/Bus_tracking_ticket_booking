from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..dependencies import get_admin_user, get_current_driver, get_current_active_user
from ..schemas import (
    Bus, BusCreate, BusUpdate, BusWithRoutes,
    Route, RouteCreate, RouteUpdate, RouteStop, Driver, User,
    QRScanResponse, GPSLocationCreate
)
from ..services.bus_service import bus_service, route_service
from ..services.map_service import map_service
from ..services.bus_tracking import bus_tracking_service

router = APIRouter(prefix="/buses", tags=["bus-management"])

# Bus Management Endpoints

@router.post("/", response_model=Bus)
async def create_bus(
    bus: BusCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Create a new bus (admin only)"""
    try:
        return bus_service.create_bus(db, bus)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/", response_model=List[Bus])
async def get_buses(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get all buses (admin only)"""
    return bus_service.get_buses(db, skip=skip, limit=limit)

@router.get("/{bus_id}", response_model=BusWithRoutes)
async def get_bus(
    bus_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get bus by ID with routes (admin only)"""
    bus = bus_service.get_bus_by_id(db, bus_id)
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    return bus

@router.put("/{bus_id}", response_model=Bus)
async def update_bus(
    bus_id: int,
    bus_update: BusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Update bus information (admin only)"""
    try:
        bus = bus_service.update_bus(db, bus_id, bus_update)
        if not bus:
            raise HTTPException(status_code=404, detail="Bus not found")
        return bus
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/{bus_id}")
async def delete_bus(
    bus_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Delete bus (admin only)"""
    try:
        success = bus_service.delete_bus(db, bus_id)
        if not success:
            raise HTTPException(status_code=404, detail="Bus not found")
        return {"message": "Bus deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

# QR Code and Tracking Endpoints

@router.get("/{bus_id}/qr-info", response_model=QRScanResponse)
async def get_bus_qr_info(
    bus_id: int,
    db: Session = Depends(get_db)
):
    """Get bus information for QR code scan (public endpoint)"""
    try:
        bus_info = bus_service.get_bus_info_for_qr(db, bus_id)
        return QRScanResponse(
            bus=bus_info["bus"],
            current_route=bus_info["current_route"],
            current_driver=bus_info["current_driver"]
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{bus_id}/qr-data")
async def get_bus_qr_data(
    bus_id: int,
    db: Session = Depends(get_db)
):
    """Get simplified bus data for QR code generation (public endpoint)"""
    try:
        bus_info = bus_service.get_bus_info_for_qr(db, bus_id)
        bus = bus_info["bus"]
        route = bus_info["current_route"]
        
        if not route:
            return {
                "bus_id": bus.id,
                "bus_number": bus.bus_number,
                "route_id": None,
                "error": "No active route assigned"
            }
        
        return {
            "bus_id": bus.id,
            "bus_number": bus.bus_number,
            "route_id": route.id,
            "route_name": route.route_name
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/gps-location")
async def record_gps_location(
    location: GPSLocationCreate,
    db: Session = Depends(get_db),
    current_driver: Driver = Depends(get_current_driver)
):
    """Record GPS location for current driver"""
    try:
        bus_service.record_gps_location(db, location, current_driver.id)
        return {"message": "GPS location recorded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/available-drivers/", response_model=List[Driver])
async def get_available_drivers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get drivers that are not assigned to any active route (admin only)"""
    return route_service.get_available_drivers(db)

# Route Management Endpoints

@router.post("/{bus_id}/routes", response_model=Route)
async def create_route(
    bus_id: int,
    route: RouteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Create a new route for a bus (admin only)"""
    try:
        # Ensure the route is for the correct bus
        route.bus_id = bus_id
        return route_service.create_route(db, route)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{bus_id}/routes", response_model=List[Route])
async def get_bus_routes(
    bus_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get all routes for a specific bus (admin only)"""
    return route_service.get_routes_by_bus(db, bus_id)

@router.get("/routes/{route_id}", response_model=Route)
async def get_route(
    route_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get route by ID (admin only)"""
    route = route_service.get_route_by_id(db, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route

@router.put("/routes/{route_id}", response_model=Route)
async def update_route(
    route_id: int,
    route_update: RouteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Update route information (admin only)"""
    try:
        route = route_service.update_route(db, route_id, route_update)
        if not route:
            raise HTTPException(status_code=404, detail="Route not found")
        return route
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/routes/{route_id}")
async def delete_route(
    route_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Delete route (admin only)"""
    try:
        success = route_service.delete_route(db, route_id)
        if not success:
            raise HTTPException(status_code=404, detail="Route not found")
        return {"message": "Route deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/routes/", response_model=List[Route])
async def get_all_routes(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get all routes (admin only)"""
    return route_service.get_routes(db, skip=skip, limit=limit)

@router.get("/routes/{route_id}/stops", response_model=List[RouteStop])
async def get_route_stops(
    route_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get all stops for a specific route (admin only)"""
    # First check if route exists
    route = route_service.get_route_by_id(db, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    return route_service.get_route_stops(db, route_id)

# Map Visualization Endpoints

@router.get("/routes/{route_id}/map-data")
async def get_route_map_data(
    route_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get route visualization data for map display (accessible to admin and drivers)"""
    try:
        route_data = map_service.get_route_visualization_data(db, route_id)
        if not route_data:
            raise HTTPException(status_code=404, detail="Route not found or has no stops")
        return route_data
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{bus_id}/live-location")
async def get_live_bus_location(
    bus_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get live GPS location of a bus (accessible to admin and drivers)"""
    try:
        location_data = map_service.get_live_bus_location(db, bus_id)
        if not location_data:
            raise HTTPException(status_code=404, detail="No GPS data found for this bus")
        return location_data
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/driver/route-map")
async def get_driver_route_map(
    db: Session = Depends(get_db),
    current_driver: Driver = Depends(get_current_driver)
):
    """Get route map data for current driver"""
    try:
        # Get driver's active route
        active_route = route_service.get_driver_active_route(db, current_driver.id)
        if not active_route:
            raise HTTPException(status_code=404, detail="No active route found")
        
        route_data = map_service.get_route_visualization_data(db, active_route.id)
        if not route_data:
            raise HTTPException(status_code=404, detail="Route data not available")
        
        return route_data
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/driver/next-stop")
async def get_next_stop_info(
    latitude: float,
    longitude: float,
    db: Session = Depends(get_db),
    current_driver: Driver = Depends(get_current_driver)
):
    """Get information about the next stop for current driver"""
    try:
        # Get driver's active route
        active_route = route_service.get_driver_active_route(db, current_driver.id)
        if not active_route:
            raise HTTPException(status_code=404, detail="No active route found")
        
        next_stop_data = map_service.calculate_distance_to_next_stop(
            latitude, longitude, active_route.id, db
        )
        
        if not next_stop_data:
            raise HTTPException(status_code=404, detail="No upcoming stops found")
        
        return next_stop_data
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

# Enhanced Bus Tracking Endpoints

@router.post("/driver/update-location")
async def update_driver_location(
    location_data: GPSLocationCreate,
    db: Session = Depends(get_db),
    current_driver: Driver = Depends(get_current_driver)
):
    """Driver location update with proximity alerts"""
    try:
        result = bus_tracking_service.update_driver_location(
            db=db,
            driver_id=current_driver.id,
            latitude=location_data.latitude,
            longitude=location_data.longitude,
            bus_id=location_data.bus_id
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/driver/proximity-check")
async def check_proximity_alerts(
    latitude: float,
    longitude: float,
    db: Session = Depends(get_db),
    current_driver: Driver = Depends(get_current_driver)
):
    """Check for proximity alerts to next stop"""
    try:
        alert = bus_tracking_service.check_proximity_to_next_stop(
            db=db,
            driver_id=current_driver.id,
            current_lat=latitude,
            current_lng=longitude
        )
        return {"proximity_alert": alert}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{bus_id}/live-tracking")
async def get_live_tracking_data(
    bus_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get live tracking data for a bus (admin and drivers)"""
    try:
        location_data = bus_tracking_service.get_live_bus_location(db, bus_id)
        if not location_data:
            raise HTTPException(status_code=404, detail="No tracking data found for this bus")
        return location_data
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/emergency-alert")
async def emergency_alert(
    emergency_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Send emergency alert from driver"""
    try:
        # Import SOS model
        from .sos import SOSAlert
        
        # Create SOS alert in database
        sos_alert = SOSAlert(
            bus_id=emergency_data.get('bus_id'),
            bus_number=emergency_data.get('bus_number', 'Unknown'),
            driver_id=emergency_data.get('driver_id', current_user.id),
            driver_name=current_user.full_name,
            latitude=emergency_data.get('latitude'),
            longitude=emergency_data.get('longitude'),
            emergency_type=emergency_data.get('emergency_type', 'other'),
            message=emergency_data.get('message', 'Emergency alert from driver'),
            priority='high'
        )
        
        db.add(sos_alert)
        db.commit()
        db.refresh(sos_alert)
        
        # Log the emergency alert
        import logging
        logging.warning(f"EMERGENCY ALERT CREATED: ID={sos_alert.id}, BUS={sos_alert.bus_id}, TYPE={sos_alert.emergency_type}")
        
        return {
            "status": "success",
            "message": "Emergency alert sent successfully",
            "alert_id": sos_alert.id,
            "timestamp": sos_alert.created_at.timestamp()
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Emergency alert failed: {str(e)}")
