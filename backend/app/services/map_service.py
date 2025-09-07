from typing import List, Dict, Any, Optional, Tuple
import openrouteservice as ors
from geopy.geocoders import Nominatim
from geopy.distance import geodesic
from sqlalchemy.orm import Session
from ..models.user import Route, RouteStop, GPSTracking
import os
from dotenv import load_dotenv

load_dotenv()

class MapService:
    def __init__(self):
        # You can get a free API key from https://openrouteservice.org/
        self.ors_api_key = os.getenv('OPENROUTESERVICE_API_KEY')
        print(f"DEBUG: OpenRouteService API Key loaded: {'YES' if self.ors_api_key else 'NO'}")
        self.client = ors.Client(key=self.ors_api_key) if self.ors_api_key else None
        self.geolocator = Nominatim(user_agent="bus_tracking_app")
    
    def geocode_address(self, address: str) -> Optional[Tuple[float, float]]:
        """Convert address to coordinates with improved fallback for Indian locations"""
        try:
            # Hardcoded coordinates for common Tamil Nadu locations
            known_locations = {
                'palani': (10.4495, 77.5153),
                'coimbatore': (11.0168, 76.9558),
                'pollachi': (10.6588, 77.0087),
                'ukkadam': (10.9895, 76.9561),
                'palani bus stand': (10.4495, 77.5153),
                'ukkadam bus stand': (10.9895, 76.9561),
                'erode': (11.3410, 77.7172),
                'salem': (11.6643, 78.1460),
                'madurai': (9.9252, 78.1198),
                'trichy': (10.7905, 78.7047),
                'chennai': (13.0827, 80.2707)
            }
            
            # Check if we have a known location first
            address_key = address.lower().strip()
            if address_key in known_locations:
                coords = known_locations[address_key]
                print(f"Using known coordinates for '{address}': [{coords[0]}, {coords[1]}]")
                return coords
            
            # Try geocoding with Tamil Nadu, India context for better accuracy
            variations = [
                address + ", Tamil Nadu, India",
                address.replace(" Bus Stand", "") + ", Tamil Nadu, India",
                address.replace(" Bus Stand", " Bus Station") + ", Tamil Nadu, India",
                address + ", Coimbatore, Tamil Nadu, India",  # Regional context
                address.split()[0] + ", Tamil Nadu, India",  # Just the city name
                address  # Try original as last resort
            ]
            
            for variation in variations:
                print(f"Trying geocoding variation: {variation}")
                location = self.geolocator.geocode(variation, timeout=10)
                if location:
                    # Validate that the result is in India (latitude 6-37, longitude 68-98)
                    if 6 <= location.latitude <= 37 and 68 <= location.longitude <= 98:
                        print(f"Successfully geocoded '{address}' using variation '{variation}' to: [{location.latitude}, {location.longitude}]")
                        return (location.latitude, location.longitude)
                    else:
                        print(f"Location outside India bounds, trying next variation...")
                        continue
            
            print(f"Failed to geocode '{address}' with all variations")
            return None
        except Exception as e:
            print(f"Geocoding error for '{address}': {e}")
            return None

    def reverse_geocode(self, latitude: float, longitude: float) -> Optional[str]:
        """Convert coordinates to address"""
        try:
            location = self.geolocator.reverse((latitude, longitude), timeout=10)
            return location.address if location else None
        except Exception as e:
            print(f"Reverse geocoding error: {e}")
            return None

    def calculate_route_by_locations(self, locations: List[str]) -> Optional[Dict[str, Any]]:
        """Calculate route between multiple locations using place names"""
        try:
            if len(locations) < 2:
                return None
            
            if not self.client:
                print("OpenRouteService client not available (API key missing)")
                return None

            print(f"Geocoding locations: {locations}")
            # Geocode all locations first
            coordinates = []
            for location in locations:
                coords = self.geocode_address(location)
                if coords:
                    # ORS expects [longitude, latitude]
                    coordinates.append([coords[1], coords[0]])
                    print(f"Geocoded '{location}' to: [{coords[1]}, {coords[0]}]")
                else:
                    print(f"Failed to geocode location: {location}")
                    return None
            
            print(f"Calculating route with {len(coordinates)} waypoints")
            route = self.client.directions(
                coordinates=coordinates,
                profile='driving-car',
                format='geojson',
                options={
                    'avoid_features': [],  # Don't avoid highways for longer routes
                    'avoid_borders': 'controlled'
                },
                extra_info=['waytype', 'surface']
            )
            
            print(f"Route calculation successful, features: {len(route.get('features', []))}")
            return route
        except Exception as e:
            print(f"Route calculation by locations error: {e}")
            return None

    def calculate_route(self, coordinates: List[List[float]]) -> Optional[Dict[str, Any]]:
        """Calculate route between coordinates"""
        try:
            if len(coordinates) < 2:
                return None
            
            if not self.client:
                print("OpenRouteService client not available (API key missing)")
                return None

            # Convert coordinates to [longitude, latitude] format for ORS
            ors_coords = [[coord[1], coord[0]] for coord in coordinates]
            
            route = self.client.directions(
                coordinates=ors_coords,
                profile='driving-car',
                format='geojson'
            )
            
            return route
        except Exception as e:
            print(f"Route calculation error: {e}")
            return None

    def get_route_visualization_data(self, db: Session, route_id: int) -> Optional[Dict[str, Any]]:
        """Get complete route data for map visualization"""
        try:
            # Get route and its stops
            route = db.query(Route).filter(Route.id == route_id).first()
            if not route:
                print(f"Route {route_id} not found")
                return None
            
            stops = db.query(RouteStop).filter(
                RouteStop.route_id == route_id
            ).order_by(RouteStop.stop_order).all()
            
            if not stops:
                print(f"No stops found for route {route_id}")
                return None
            
            # Prepare stop data and ensure all stops have coordinates
            stop_data = []
            for stop in stops:
                # If coordinates are missing, try to geocode
                latitude = stop.latitude
                longitude = stop.longitude
                
                if (not latitude or not longitude) and stop.location_name:
                    print(f"Geocoding missing coordinates for stop: {stop.location_name}")
                    coords = self.geocode_address(stop.location_name)
                    if coords:
                        latitude = coords[0]
                        longitude = coords[1]
                        # Update the database with the geocoded coordinates
                        stop.latitude = latitude
                        stop.longitude = longitude
                        db.commit()
                        print(f"Updated stop {stop.stop_name} with coordinates: [{latitude}, {longitude}]")
                
                stop_data.append({
                    'id': stop.id,
                    'name': stop.stop_name,
                    'location_name': stop.location_name,
                    'latitude': latitude,
                    'longitude': longitude,
                    'order': stop.stop_order
                })
            
            # Prepare location names for route calculation
            location_names = []
            coordinates = []
            
            # Add origin
            if route.origin:
                location_names.append(route.origin)
                origin_coords = self.geocode_address(route.origin)
                if origin_coords:
                    coordinates.append([origin_coords[0], origin_coords[1]])
            
            # Add intermediate stops (use the updated coordinates from stop_data)
            for stop_info in stop_data:
                if stop_info['location_name']:
                    location_names.append(stop_info['location_name'])
                    if stop_info['latitude'] and stop_info['longitude']:
                        coordinates.append([stop_info['latitude'], stop_info['longitude']])
                    else:
                        print(f"Could not get coordinates for stop: {stop_info['location_name']}")
            
            # Add destination
            if route.destination and route.destination != route.origin:
                location_names.append(route.destination)
                dest_coords = self.geocode_address(route.destination)
                if dest_coords:
                    coordinates.append([dest_coords[0], dest_coords[1]])
            
            print(f"Route {route_id}: {len(location_names)} locations, {len(coordinates)} coordinates")
            
            route_geometry = None
            if len(location_names) >= 2:
                print(f"Calculating route using locations: {' -> '.join(location_names)}")
                # Calculate route geometry using location names (for proper routing)
                route_geometry = self.calculate_route_by_locations(location_names)
                print(f"DEBUG: Route geometry result: {route_geometry is not None}")
                
                # If location-based routing fails, fallback to coordinate-based routing
                if not route_geometry and len(coordinates) >= 2:
                    print("Location-based routing failed, falling back to coordinate-based routing")
                    route_geometry = self.calculate_route(coordinates)
                    print(f"DEBUG: Fallback route geometry result: {route_geometry is not None}")
            
            # Calculate total distance
            total_distance = 0
            if route_geometry and 'features' in route_geometry and len(route_geometry['features']) > 0:
                # Use the distance from the routing service
                properties = route_geometry['features'][0].get('properties', {})
                segments = properties.get('segments', [])
                if segments:
                    total_distance = sum(segment.get('distance', 0) for segment in segments) / 1000  # Convert to km
                else:
                    # Fallback: calculate from coordinates
                    for i in range(len(coordinates) - 1):
                        distance = geodesic(coordinates[i], coordinates[i + 1]).kilometers
                        total_distance += distance
            else:
                # Fallback: calculate straight-line distance
                for i in range(len(coordinates) - 1):
                    distance = geodesic(coordinates[i], coordinates[i + 1]).kilometers
                    total_distance += distance
            
            result = {
                'route_id': route.id,
                'route_name': route.route_name,
                'bus_id': route.bus_id,
                'driver_id': route.driver_id,
                'stops': stop_data,
                'geometry': route_geometry,
                'total_distance_km': round(total_distance, 2),
                'total_stops': len(stops)
            }
            
            print(f"DEBUG: Returning route data with geometry: {route_geometry is not None}")
            return result
            
        except Exception as e:
            print(f"Error getting route visualization data: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def get_live_bus_location(self, db: Session, bus_id: int) -> Optional[Dict[str, Any]]:
        """Get the latest GPS location for a bus"""
        try:
            latest_location = db.query(GPSTracking).filter(
                GPSTracking.bus_id == bus_id
            ).order_by(GPSTracking.timestamp.desc()).first()
            
            if not latest_location:
                return None
            
            return {
                'bus_id': bus_id,
                'latitude': latest_location.latitude,
                'longitude': latest_location.longitude,
                'accuracy': latest_location.accuracy,
                'speed': latest_location.speed,
                'heading': latest_location.heading,
                'timestamp': latest_location.timestamp.isoformat()
            }
            
        except Exception as e:
            print(f"Error getting live bus location: {e}")
            return None
    
    def calculate_distance_to_next_stop(self, latitude: float, longitude: float, route_id: int, db: Session) -> Optional[Dict[str, Any]]:
        """Calculate distance to the next stop for a driver"""
        try:
            # Get all stops for the route
            stops = db.query(RouteStop).filter(
                RouteStop.route_id == route_id
            ).order_by(RouteStop.stop_order).all()
            
            if not stops:
                return None
            
            current_location = (latitude, longitude)
            
            # Find the closest stop (assuming it's the next one)
            min_distance = float('inf')
            next_stop = None
            
            for stop in stops:
                if stop.latitude and stop.longitude:
                    stop_location = (stop.latitude, stop.longitude)
                    distance = geodesic(current_location, stop_location).kilometers
                    
                    if distance < min_distance:
                        min_distance = distance
                        next_stop = stop
            
            if next_stop:
                # Estimate time based on average speed (40 km/h)
                estimated_time_minutes = (min_distance / 40) * 60
                
                return {
                    'next_stop': {
                        'id': next_stop.id,
                        'name': next_stop.stop_name,
                        'location_name': next_stop.location_name,
                        'latitude': next_stop.latitude,
                        'longitude': next_stop.longitude,
                        'stop_order': next_stop.stop_order
                    },
                    'distance_km': round(min_distance, 2),
                    'estimated_time_minutes': round(estimated_time_minutes, 1)
                }
            
            return None
            
        except Exception as e:
            print(f"Error calculating distance to next stop: {e}")
            return None

# Create a global instance
map_service = MapService()
