from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import time, datetime
from ..models.user import Bus, Route, Driver, GPSTracking, RouteStop
from ..schemas import BusCreate, BusUpdate, RouteCreate, RouteUpdate, GPSLocationCreate
from .qr_service import qr_service
import logging

logger = logging.getLogger(__name__)

class BusService:
    def __init__(self):
        pass
    
    def create_bus(self, db: Session, bus_data: BusCreate) -> Bus:
        """Create a new bus with QR code generation"""
        try:
            # Check if bus number already exists
            existing_bus = db.query(Bus).filter(Bus.bus_number == bus_data.bus_number).first()
            if existing_bus:
                raise ValueError(f"Bus with number {bus_data.bus_number} already exists")
            
            db_bus = Bus(
                bus_number=bus_data.bus_number,
                capacity=bus_data.capacity,
                bus_type=bus_data.bus_type,
                origin_depot=bus_data.origin_depot,
                is_active=True
            )
            db.add(db_bus)
            db.flush()  # Get the bus ID before committing
            
            # Generate QR code with bus details
            bus_dict = {
                "id": db_bus.id,
                "bus_number": db_bus.bus_number,
                "bus_type": db_bus.bus_type,
                "capacity": db_bus.capacity,
                "origin_depot": db_bus.origin_depot
            }
            
            qr_code_data = qr_service.generate_bus_qr_code(bus_dict)
            db_bus.qr_code = qr_code_data
            
            db.commit()
            db.refresh(db_bus)
            
            logger.info(f"Created bus with QR code: {bus_data.bus_number}")
            return db_bus
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating bus: {str(e)}")
            raise
    
    def get_buses(self, db: Session, skip: int = 0, limit: int = 100) -> List[Bus]:
        """Get all active buses with pagination"""
        return db.query(Bus).filter(Bus.is_active == True).offset(skip).limit(limit).all()
    
    def get_bus_by_id(self, db: Session, bus_id: int) -> Optional[Bus]:
        """Get bus by ID"""
        return db.query(Bus).filter(Bus.id == bus_id).first()
    
    def get_bus_by_number(self, db: Session, bus_number: str) -> Optional[Bus]:
        """Get bus by bus number"""
        return db.query(Bus).filter(Bus.bus_number == bus_number).first()
    
    def update_bus(self, db: Session, bus_id: int, bus_update: BusUpdate) -> Optional[Bus]:
        """Update bus information"""
        try:
            db_bus = db.query(Bus).filter(Bus.id == bus_id).first()
            if not db_bus:
                return None
            
            update_data = bus_update.dict(exclude_unset=True)
            
            # Check if bus number is being updated and doesn't conflict
            if "bus_number" in update_data:
                existing_bus = db.query(Bus).filter(
                    Bus.bus_number == update_data["bus_number"],
                    Bus.id != bus_id
                ).first()
                if existing_bus:
                    raise ValueError(f"Bus number {update_data['bus_number']} already exists")
            
            for field, value in update_data.items():
                setattr(db_bus, field, value)
            
            db.commit()
            db.refresh(db_bus)
            
            logger.info(f"Updated bus {bus_id}")
            return db_bus
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating bus {bus_id}: {str(e)}")
            raise
    
    def delete_bus(self, db: Session, bus_id: int) -> bool:
        """Delete bus permanently"""
        try:
            db_bus = db.query(Bus).filter(Bus.id == bus_id).first()
            if not db_bus:
                return False
            
            # Check if bus has active routes
            active_routes = db.query(Route).filter(
                Route.bus_id == bus_id
            ).count()
            
            if active_routes > 0:
                raise ValueError("Cannot delete bus with existing routes. Please delete routes first.")
            
            # Hard delete the bus
            db.delete(db_bus)
            db.commit()
            
            logger.info(f"Deleted bus {bus_id}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting bus {bus_id}: {str(e)}")
            raise

    def get_bus_info_for_qr(self, db: Session, bus_id: int) -> dict:
        """Get bus information along with current route and driver for QR scan response"""
        try:
            bus = db.query(Bus).filter(Bus.id == bus_id).first()
            if not bus:
                raise ValueError("Bus not found")
            
            # Get current active route for this bus
            current_route = db.query(Route).filter(
                Route.bus_id == bus_id,
                Route.is_active == True
            ).first()
            
            current_driver = None
            if current_route and current_route.driver_id:
                current_driver = db.query(Driver).filter(
                    Driver.id == current_route.driver_id
                ).first()
            
            return {
                "bus": bus,
                "current_route": current_route,
                "current_driver": current_driver
            }
            
        except Exception as e:
            logger.error(f"Error getting bus info for QR: {str(e)}")
            raise

    def record_gps_location(self, db: Session, location_data: GPSLocationCreate, driver_id: int) -> None:
        """Record GPS location for a driver"""
        try:
            # Get current route for the driver
            current_route = db.query(Route).filter(
                Route.driver_id == driver_id,
                Route.is_active == True
            ).first()
            
            gps_record = GPSTracking(
                latitude=location_data.latitude,
                longitude=location_data.longitude,
                driver_id=driver_id,
                bus_id=location_data.bus_id,
                route_id=current_route.id if current_route else None
            )
            
            db.add(gps_record)
            db.commit()
            
            logger.info(f"Recorded GPS location for driver {driver_id}")
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error recording GPS location: {str(e)}")
            raise

class RouteService:
    def __init__(self):
        pass
    
    def get_available_drivers(self, db: Session) -> List[Driver]:
        """Get drivers that are not assigned to any active route"""
        assigned_driver_ids = db.query(Route.driver_id).filter(
            Route.driver_id.isnot(None),
            Route.is_active == True
        ).subquery()
        
        return db.query(Driver).filter(
            Driver.is_active == True,
            ~Driver.id.in_(assigned_driver_ids)
        ).all()
    
    def create_route(self, db: Session, route_data: RouteCreate) -> Route:
        """Create a new route assignment with stops"""
        try:
            # Check if bus exists
            bus = db.query(Bus).filter(Bus.id == route_data.bus_id).first()
            if not bus:
                raise ValueError("Bus not found")
            
            # Check if driver exists and is available
            if route_data.driver_id:
                driver = db.query(Driver).filter(
                    Driver.id == route_data.driver_id,
                    Driver.is_active == True
                ).first()
                if not driver:
                    raise ValueError("Driver not found or inactive")
                
                # Check if driver is already assigned to another active route
                existing_route = db.query(Route).filter(
                    Route.driver_id == route_data.driver_id,
                    Route.is_active == True,
                    Route.id != None  # Exclude current route if updating
                ).first()
                if existing_route:
                    raise ValueError(f"Driver is already assigned to route: {existing_route.route_name}")
            
            # Create route
            db_route = Route(
                route_name=route_data.route_name,
                origin=route_data.origin,
                destination=route_data.destination,
                distance_km=route_data.distance_km,
                estimated_duration_minutes=route_data.estimated_duration_minutes,
                bus_id=route_data.bus_id,
                driver_id=route_data.driver_id,
                is_active=True
            )
            db.add(db_route)
            db.flush()  # Flush to get the route ID
            
            # Create route stops if provided
            if route_data.stops:
                for stop_data in route_data.stops:
                    db_stop = RouteStop(
                        route_id=db_route.id,
                        stop_name=stop_data.stop_name,
                        location_name=stop_data.location_name,
                        stop_order=stop_data.stop_order,
                        latitude=stop_data.latitude,
                        longitude=stop_data.longitude
                    )
                    db.add(db_stop)
            
            db.commit()
            
            # Fetch the created route with relationships loaded
            from sqlalchemy.orm import joinedload
            created_route = db.query(Route).options(
                joinedload(Route.bus),
                joinedload(Route.driver),
                joinedload(Route.stops)
            ).filter(Route.id == db_route.id).first()
            
            logger.info(f"Created route: {route_data.route_name} with {len(route_data.stops) if route_data.stops else 0} stops")
            return created_route
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating route: {str(e)}")
            raise
    
    def get_routes(self, db: Session, skip: int = 0, limit: int = 100) -> List[Route]:
        """Get all active routes with pagination, automatically clean up expired routes"""
        from datetime import datetime, timedelta
        from sqlalchemy.orm import joinedload
        
        try:
            # Clean up expired routes (older than 1 day)
            cutoff_date = datetime.utcnow() - timedelta(days=1)
            expired_routes = db.query(Route).filter(
                Route.created_at < cutoff_date,
                Route.is_active == True
            ).all()
            
            if expired_routes:
                for route in expired_routes:
                    route.is_active = False
                db.commit()
                logger.info(f"Deactivated {len(expired_routes)} expired routes")
            
            # Return only active routes with eagerly loaded relationships
            return db.query(Route).options(
                joinedload(Route.bus),
                joinedload(Route.driver),
                joinedload(Route.stops)
            ).filter(Route.is_active == True).offset(skip).limit(limit).all()
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error fetching routes: {str(e)}")
            return []
    
    def get_route_by_id(self, db: Session, route_id: int) -> Optional[Route]:
        """Get route by ID with eagerly loaded relationships"""
        from sqlalchemy.orm import joinedload
        return db.query(Route).options(
            joinedload(Route.bus),
            joinedload(Route.driver),
            joinedload(Route.stops)
        ).filter(Route.id == route_id).first()
    
    def get_routes_by_bus(self, db: Session, bus_id: int) -> List[Route]:
        """Get all routes for a specific bus with eagerly loaded relationships"""
        from sqlalchemy.orm import joinedload
        return db.query(Route).options(
            joinedload(Route.bus),
            joinedload(Route.driver),
            joinedload(Route.stops)
        ).filter(Route.bus_id == bus_id).all()
    
    def get_route_stops(self, db: Session, route_id: int) -> List[RouteStop]:
        """Get all stops for a specific route ordered by stop_order"""
        return db.query(RouteStop).filter(
            RouteStop.route_id == route_id
        ).order_by(RouteStop.stop_order).all()
    
    def update_route(self, db: Session, route_id: int, route_update: RouteUpdate) -> Optional[Route]:
        """Update route information"""
        from sqlalchemy.orm import joinedload
        try:
            db_route = db.query(Route).filter(Route.id == route_id).first()
            if not db_route:
                return None
            
            update_data = route_update.dict(exclude_unset=True)
            
            for field, value in update_data.items():
                setattr(db_route, field, value)
            
            db.commit()
            
            # Fetch the updated route with relationships loaded
            updated_route = db.query(Route).options(
                joinedload(Route.bus),
                joinedload(Route.driver),
                joinedload(Route.stops)
            ).filter(Route.id == route_id).first()
            
            logger.info(f"Updated route {route_id}")
            return updated_route
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating route {route_id}: {str(e)}")
            raise
    
    def delete_route(self, db: Session, route_id: int) -> bool:
        """Delete route permanently"""
        try:
            db_route = db.query(Route).filter(Route.id == route_id).first()
            if not db_route:
                return False
            
            # Hard delete the route
            db.delete(db_route)
            db.commit()
            
            logger.info(f"Deleted route {route_id}")
            return True
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting route {route_id}: {str(e)}")
            raise
    
    def get_driver_active_route(self, db: Session, driver_id: int) -> Optional[Route]:
        """Get the active route for a specific driver"""
        try:
            return db.query(Route).filter(
                Route.driver_id == driver_id,
                Route.is_active == True
            ).first()
        except Exception as e:
            logger.error(f"Error getting driver active route: {str(e)}")
            raise


# Create service instances
bus_service = BusService()
route_service = RouteService()
