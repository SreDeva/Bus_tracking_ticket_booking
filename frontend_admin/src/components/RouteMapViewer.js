import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { useAuth } from '../contexts/AuthContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const busStopIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/32/906/906794.png',
  iconSize: [25, 25],
  iconAnchor: [12, 25],
  popupAnchor: [0, -25]
});

const busIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/32/3774/3774299.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

const RouteMapViewer = ({ routeId, onClose }) => {
  const { token: authToken, user, loading: authLoading } = useAuth();
  // Fallback to localStorage if AuthContext token is not available
  const token = authToken || localStorage.getItem('token');
  const [routeData, setRouteData] = useState(null);
  const [busLocation, setBusLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log('DEBUG: RouteMapViewer auth state:', { 
    authToken: authToken ? authToken.substring(0, 20) + '...' : 'NULL',
    localStorageToken: localStorage.getItem('token') ? localStorage.getItem('token').substring(0, 20) + '...' : 'NULL',
    finalToken: token ? token.substring(0, 20) + '...' : 'NULL',
    user: user ? 'EXISTS' : 'NULL', 
    authLoading
  });

  useEffect(() => {
    console.log('DEBUG: useEffect triggered with:', { authLoading, token: token ? 'EXISTS' : 'NULL' });
    if (token) {
      console.log('DEBUG: Calling fetchRouteData');
      fetchRouteData();
      const interval = setInterval(fetchBusLocation, 10000); // Update bus location every 10 seconds
      return () => clearInterval(interval);
    } else {
      console.log('DEBUG: No token available, setting error');
      setError('Authentication required - please log in again');
      setLoading(false);
    }
  }, [routeId, token]);

  const fetchRouteData = async () => {
    try {
      console.log('DEBUG: Fetching route data with token:', token ? token.substring(0, 20) + '...' : 'NO TOKEN');
      
      if (!token) {
        setError('No authentication token available');
        setLoading(false);
        return;
      }
      
      const response = await fetch(`http://localhost:8000/buses/routes/${routeId}/map-data`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('DEBUG: Response status:', response.status);
      console.log('DEBUG: Response headers:', response.headers);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('DEBUG: Error response:', errorText);
        throw new Error('Failed to fetch route data');
      }
      const data = await response.json();
      console.log('DEBUG: Route data received:', data);
      setRouteData(data);
      
      // Also fetch initial bus location
      fetchBusLocation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchBusLocation = async () => {
    if (!routeData) return;
    
    try {
      const response = await fetch(`http://localhost:8000/buses/${routeData.bus_id}/live-location`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const location = await response.json();
        setBusLocation(location);
      }
    } catch (err) {
      console.error('Failed to fetch bus location:', err);
    }
  };

  if (authLoading && !token) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg">
          <div className="text-center">Loading authentication...</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-center">Loading route map...</p>
        </div>
      </div>
    );
  }

  if (error || !routeData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg max-w-md">
          <h3 className="text-lg font-semibold text-red-600 mb-2">Error</h3>
          <p className="text-gray-600 mb-4">{error || 'Failed to load route data'}</p>
          <button
            onClick={onClose}
            className="w-full bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Calculate map center and bounds
  const center = routeData.stops.length > 0 
    ? [routeData.stops[0].latitude, routeData.stops[0].longitude]
    : [10.4620, 77.5284]; // Default to Coimbatore

  // Extract route coordinates from geometry
  console.log('Route geometry data:', routeData.geometry);
  
  let routeCoordinates = [];
  
  // Try to get proper route geometry first
  if (routeData.geometry?.features?.[0]?.geometry?.coordinates) {
    routeCoordinates = routeData.geometry.features[0].geometry.coordinates.map(
      (coord) => [coord[1], coord[0]] // Convert [lon, lat] to [lat, lon]
    );
    console.log('Using route geometry with', routeCoordinates.length, 'points');
  } else {
    // Fallback to straight lines between stops
    routeCoordinates = routeData.stops.map(stop => [stop.latitude, stop.longitude]);
    console.log('Using fallback straight lines between', routeCoordinates.length, 'stops');
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-11/12 h-5/6 max-w-6xl max-h-screen overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              Route Map: {routeData.route_name}
            </h2>
            <div className="text-sm text-gray-600 mt-1">
              <span className="mr-4">🚌 Bus ID: {routeData.bus_id}</span>
              <span className="mr-4">📍 {routeData.total_stops} stops</span>
              <span className="mr-4">📏 {routeData.total_distance_km} km</span>
              {busLocation && (
                <span className="text-green-600">🟢 Live tracking</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Map */}
        <div className="h-full p-4">
          <MapContainer
            center={center}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            className="rounded-lg"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {/* Route line */}
            {routeCoordinates.length > 1 && (
              <Polyline
                positions={routeCoordinates}
                color="#3B82F6"
                weight={4}
                opacity={0.7}
              />
            )}
            
            {/* Bus stops */}
            {routeData.stops.filter(stop => stop.latitude && stop.longitude).map((stop, index) => (
              <Marker
                key={stop.id}
                position={[stop.latitude, stop.longitude]}
                icon={busStopIcon}
              >
                <Popup>
                  <div className="text-center">
                    <h4 className="font-semibold">{stop.name}</h4>
                    <p className="text-sm text-gray-600">Stop #{stop.order}</p>
                    {stop.estimated_arrival && (
                      <p className="text-sm text-blue-600">
                        ETA: {new Date(stop.estimated_arrival).toLocaleTimeString()}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {stop.latitude?.toFixed(6)}, {stop.longitude?.toFixed(6)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
            
            {/* Live bus location */}
            {busLocation && (
              <Marker
                position={[busLocation.latitude, busLocation.longitude]}
                icon={busIcon}
              >
                <Popup>
                  <div className="text-center">
                    <h4 className="font-semibold">🚌 Bus {routeData.bus_id}</h4>
                    <p className="text-sm text-green-600">Live Location</p>
                    <p className="text-sm text-gray-600">
                      Speed: {busLocation.speed?.toFixed(1) || 0} km/h
                    </p>
                    <p className="text-sm text-gray-600">
                      Accuracy: {busLocation.accuracy?.toFixed(0) || 0}m
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Updated: {new Date(busLocation.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default RouteMapViewer;
