"""
Geocoding service using geopy + Nominatim
Converts place names to GPS coordinates
"""
from typing import Optional, Tuple
from geopy.geocoders import Nominatim
import time

class GeocodingService:
    def __init__(self):
        self.geolocator = Nominatim(user_agent="bus_tracking_app", timeout=10)
    
    def get_coordinates(self, stop_name: str) -> Optional[Tuple[float, float]]:
        """
        Convert stop name to GPS coordinates
        Returns: (latitude, longitude) or None if geocoding fails
        """
        try:
            # Add slight delay to respect Nominatim usage policy
            time.sleep(1)
            
            location = self.geolocator.geocode(stop_name)
            if location:
                return (location.latitude, location.longitude)
            return None
        except Exception as e:
            print(f"Geocoding error for '{stop_name}': {e}")
            return None
    
    def reverse_geocode(self, lat: float, lng: float) -> Optional[str]:
        """
        Convert GPS coordinates to address
        Returns: address string or None if reverse geocoding fails
        """
        try:
            time.sleep(1)  # Respect usage policy
            
            location = self.geolocator.reverse((lat, lng))
            if location:
                return location.address
            return None
        except Exception as e:
            print(f"Reverse geocoding error for ({lat}, {lng}): {e}")
            return None

# Global instance
geocoding_service = GeocodingService()
