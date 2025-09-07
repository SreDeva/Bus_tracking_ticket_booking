"""
Bus tracking service for driver location updates and proximity alerts
Handles GPS updates, distance calculations, and proximity notifications
"""
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from geopy.distance import geodesic
from datetime import datetime
from ..models.user import GPSTracking, Route, RouteStop, Driver
from .geocoding import geocoding_service

class BusTrackingService:
    def __init__(self):
        self.proximity_threshold = 100  # meters
    
    def update_driver_location(self, db: Session, driver_id: int, latitude: float, longitude: float, 
                             bus_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Receive GPS from driver and store in DB
        
        Args:
            db: Database session
            driver_id: ID of the driver
            latitude: Current GPS latitude
            longitude: Current GPS longitude
            bus_id: Optional bus ID if known
            
        Returns:
            {
                'success': bool,
                'proximity_alert': dict or None,
                'next_stop': dict or None
            }
        """
        try:
            # Store GPS location in database
            gps_record = GPSTracking(
                driver_id=driver_id,
                bus_id=bus_id,
                latitude=latitude,
                longitude=longitude,
                timestamp=datetime.utcnow()
            )
            db.add(gps_record)
            db.commit()
            
            # Check for proximity alerts
            proximity_alert = self.check_proximity_to_next_stop(db, driver_id, latitude, longitude)
            next_stop_info = self.get_next_stop_info(db, driver_id, latitude, longitude)
            
            return {
                'success': True,
                'proximity_alert': proximity_alert,
                'next_stop': next_stop_info,
                'location_stored': True
            }
            
        except Exception as e:
            print(f"Error updating driver location: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def check_proximity_to_next_stop(self, db: Session, driver_id: int, 
                                   current_lat: float, current_lng: float) -> Optional[Dict[str, Any]]:
        """
        Check distance to next stop using geopy.distance
        Trigger buzzer/notification if within 100m
        
        Returns:
            Alert dict if within threshold, None otherwise
        """
        try:
            # Get driver's active route
            driver = db.query(Driver).filter(Driver.id == driver_id).first()
            if not driver:
                return None
            
            # Find active route for this driver
            active_route = db.query(Route).filter(
                Route.driver_id == driver_id,
                Route.is_active == True
            ).first()
            
            if not active_route:
                return None
            
            # Get all stops for this route
            stops = db.query(RouteStop).filter(
                RouteStop.route_id == active_route.id
            ).order_by(RouteStop.stop_order).all()
            
            current_location = (current_lat, current_lng)
            
            # Find the next stop (closest unvisited stop)
            min_distance = float('inf')
            next_stop = None
            
            for stop in stops:
                if stop.latitude and stop.longitude:
                    stop_location = (stop.latitude, stop.longitude)
                    distance = geodesic(current_location, stop_location).meters
                    
                    if distance < min_distance:
                        min_distance = distance
                        next_stop = stop
            
            # Check if within proximity threshold
            if next_stop and min_distance <= self.proximity_threshold:
                return {
                    'alert': True,
                    'message': f"Approaching {next_stop.location_name}",
                    'stop_name': next_stop.location_name,
                    'distance_meters': round(min_distance, 1),
                    'stop_order': next_stop.stop_order,
                    'trigger_buzzer': True,
                    'notification_type': 'proximity_alert'
                }
            
            return None
            
        except Exception as e:
            print(f"Error checking proximity: {e}")
            return None
    
    def get_next_stop_info(self, db: Session, driver_id: int, 
                          current_lat: float, current_lng: float) -> Optional[Dict[str, Any]]:
        """
        Get information about the next stop for the driver
        """
        try:
            # Get driver's active route
            active_route = db.query(Route).filter(
                Route.driver_id == driver_id,
                Route.is_active == True
            ).first()
            
            if not active_route:
                return None
            
            # Get all stops for this route
            stops = db.query(RouteStop).filter(
                RouteStop.route_id == active_route.id
            ).order_by(RouteStop.stop_order).all()
            
            current_location = (current_lat, current_lng)
            
            # Find the closest stop (assuming it's the next one)
            min_distance = float('inf')
            next_stop = None
            
            for stop in stops:
                if stop.latitude and stop.longitude:
                    stop_location = (stop.latitude, stop.longitude)
                    distance = geodesic(current_location, stop_location).meters
                    
                    if distance < min_distance:
                        min_distance = distance
                        next_stop = stop
            
            if next_stop:
                return {
                    'stop_name': next_stop.location_name,
                    'stop_order': next_stop.stop_order,
                    'distance_meters': round(min_distance, 1),
                    'distance_km': round(min_distance / 1000, 2),
                    'latitude': next_stop.latitude,
                    'longitude': next_stop.longitude,
                    'within_proximity': min_distance <= self.proximity_threshold
                }
            
            return None
            
        except Exception as e:
            print(f"Error getting next stop info: {e}")
            return None
    
    def get_live_bus_location(self, db: Session, bus_id: int) -> Optional[Dict[str, Any]]:
        """
        Get the most recent GPS location for a bus
        """
        try:
            latest_location = db.query(GPSTracking).filter(
                GPSTracking.bus_id == bus_id
            ).order_by(GPSTracking.timestamp.desc()).first()
            
            if latest_location:
                return {
                    'bus_id': bus_id,
                    'latitude': latest_location.latitude,
                    'longitude': latest_location.longitude,
                    'timestamp': latest_location.timestamp.isoformat(),
                    'driver_id': latest_location.driver_id
                }
            
            return None
            
        except Exception as e:
            print(f"Error getting live bus location: {e}")
            return None
    
    def set_proximity_threshold(self, meters: int):
        """Set the proximity threshold for alerts"""
        self.proximity_threshold = meters

# Global instance
bus_tracking_service = BusTrackingService()
