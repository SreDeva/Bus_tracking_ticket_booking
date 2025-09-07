import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';
import WebMap from './WebMap';

// API Configuration - should match AuthContext
const API_BASE_URL = 'http://10.26.181.214:8000';

interface RouteMapProps {
  busInfo: any;
  onClose: () => void;
}

interface Stop {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  stop_order: number;
  estimated_arrival: string | null;
}

interface RouteData {
  route_id: number;
  route_name: string;
  bus_id: number;
  driver_id: number;
  stops: Stop[];
  geometry: any;
  total_distance_km: number;
  total_stops: number;
}

interface NextStopInfo {
  next_stop: {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    stop_order: number;
  };
  distance_km: number;
  estimated_time_minutes: number;
}

const RouteMap: React.FC<RouteMapProps> = ({ busInfo, onClose }) => {
  const { token } = useAuth();
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [nextStopInfo, setNextStopInfo] = useState<NextStopInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useWebMap, setUseWebMap] = useState(true); // Default to WebMap since native map requires Google API

  useEffect(() => {
    fetchRouteData();
    getCurrentLocation();
    const interval = setInterval(updateLocation, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchRouteData = async () => {
    try {
      console.log('Fetching route data...');
      const response = await fetch(`${API_BASE_URL}/buses/driver/route-map`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Route data response status:', response.status);
      if (!response.ok) {
        throw new Error('Failed to fetch route data');
      }
      const data = await response.json();
      console.log('Route data received:', data);
      console.log('Stops in route data:', data?.stops);
      console.log('Geometry in route data:', data?.geometry);
      setRouteData(data);
    } catch (err) {
      console.error('Error fetching route data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for navigation');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(location);
      updateNextStopInfo(location.coords.latitude, location.coords.longitude);
    } catch (err) {
      console.error('Error getting location:', err);
    }
  };

  const updateLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(location);
      updateNextStopInfo(location.coords.latitude, location.coords.longitude);
    } catch (err) {
      console.error('Error updating location:', err);
    }
  };

  const updateNextStopInfo = async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/buses/driver/next-stop?latitude=${latitude}&longitude=${longitude}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setNextStopInfo(data);
      }
    } catch (err) {
      console.error('Error fetching next stop info:', err);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading route map...</Text>
      </View>
    );
  }

  if (error || !routeData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error || 'Failed to load route data'}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Calculate map region
  const calculateRegion = () => {
    console.log('Calculating region - routeData:', routeData);
    console.log('Route stops count:', routeData?.stops?.length);
    
    if (!routeData?.stops?.length) {
      console.log('No stops found, using default region');
      return {
        latitude: 10.4620,
        longitude: 77.5284,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    const latitudes = routeData?.stops?.map(stop => {
      console.log('Stop latitude:', stop.latitude);
      return stop.latitude;
    }) || [];
    const longitudes = routeData?.stops?.map(stop => {
      console.log('Stop longitude:', stop.longitude);
      return stop.longitude;
    }) || [];
    
    if (currentLocation) {
      latitudes.push(currentLocation.coords.latitude);
      longitudes.push(currentLocation.coords.longitude);
    }

    if (latitudes.length === 0 || longitudes.length === 0) {
      console.log('No valid coordinates found');
      return {
        latitude: 10.4620,
        longitude: 77.5284,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    const deltaLat = Math.max(maxLat - minLat, 0.01);
    const deltaLng = Math.max(maxLng - minLng, 0.01);

    const region = {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: deltaLat * 1.5,
      longitudeDelta: deltaLng * 1.5,
    };
    
    console.log('Calculated region:', region);
    return region;
  };

  // Generate route coordinates
  const routeCoordinates = routeData?.stops?.map(stop => {
    const coord = {
      latitude: stop.latitude,
      longitude: stop.longitude,
    };
    console.log('Generated coordinate:', coord);
    // Validate coordinates
    if (isNaN(coord.latitude) || isNaN(coord.longitude)) {
      console.warn('Invalid coordinate detected:', coord);
      return null;
    }
    return coord;
  }).filter(coord => coord !== null) || [];
  
  console.log('Final route coordinates:', routeCoordinates);
  console.log('Number of stops for markers:', routeData?.stops?.length);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{routeData?.route_name || 'Loading...'}</Text>
          <TouchableOpacity onPress={onClose} style={styles.headerCloseButton}>
            <Text style={styles.headerCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerInfoText}>🚌 Bus {busInfo?.bus?.bus_number || 'Unknown'}</Text>
          <Text style={styles.headerInfoText}>📍 {routeData?.total_stops || 0} stops</Text>
          <Text style={styles.headerInfoText}>📏 {routeData?.total_distance_km || 0} km</Text>
          <TouchableOpacity 
            onPress={() => setUseWebMap(!useWebMap)}
            style={styles.mapToggleButton}
          >
            <Text style={styles.mapToggleText}>
              {useWebMap ? 'Native Map' : 'Web Map'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Map */}
      {useWebMap ? (
        <WebMap
          stops={routeData?.stops || []}
          routeGeometry={routeData?.geometry}
          currentLocation={currentLocation?.coords}
          region={calculateRegion()}
        />
      ) : (
        <MapView
          style={styles.map}
          region={calculateRegion()}
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsTraffic={false}
          onRegionChange={(region) => console.log('Map region changed:', region)}
          onMapReady={() => console.log('Map is ready')}
        >
          {/* Route line */}
          {(() => {
            console.log('Polyline check - coordinates length:', routeCoordinates.length);
            return routeCoordinates.length > 1 && (
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="#3B82F6"
                strokeWidth={4}
              />
            );
          })()}

          {/* Bus stops */}
          {routeData?.stops?.filter(stop => 
            stop.latitude && stop.longitude && 
            !isNaN(stop.latitude) && !isNaN(stop.longitude)
          ).map((stop, index) => {
            console.log(`Rendering marker ${index} for stop:`, stop);
            return (
              <Marker
                key={stop.id}
                coordinate={{
                  latitude: Number(stop.latitude),
                  longitude: Number(stop.longitude),
                }}
                title={stop.name}
                description={`Stop #${stop.stop_order}`}
                pinColor={nextStopInfo?.next_stop.id === stop.id ? "#FF6B6B" : "#4ECDC4"}
              />
            );
          })}
          
          {/* Test marker for debugging - Palani coordinates */}
          <Marker
            coordinate={{
              latitude: 10.4620,
              longitude: 77.5284,
            }}
            title="Test Marker - Palani"
            description="This marker should always be visible"
            pinColor="#FF0000"
          />
        </MapView>
      )}

      {/* Next Stop Info */}
      {nextStopInfo && (
        <View style={styles.nextStopContainer}>
          <Text style={styles.nextStopTitle}>Next Stop</Text>
          <Text style={styles.nextStopName}>{nextStopInfo.next_stop.name}</Text>
          <View style={styles.nextStopDetails}>
            <Text style={styles.nextStopDetailText}>
              📍 {nextStopInfo.distance_km} km away
            </Text>
            <Text style={styles.nextStopDetailText}>
              ⏱️ ~{nextStopInfo.estimated_time_minutes} minutes
            </Text>
          </View>
        </View>
      )}

      {/* Route Summary */}
      <ScrollView style={styles.stopsContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.stopsTitle}>Route Stops</Text>
        {routeData?.stops?.map((stop, index) => (
          <View 
            key={stop.id} 
            style={[
              styles.stopItem,
              nextStopInfo?.next_stop.id === stop.id && styles.nextStopItem
            ]}
          >
            <View style={styles.stopNumber}>
              <Text style={styles.stopNumberText}>{stop.stop_order}</Text>
            </View>
            <View style={styles.stopInfo}>
              <Text style={styles.stopName}>{stop.name}</Text>
              {stop.estimated_arrival && (
                <Text style={styles.stopTime}>
                  ETA: {new Date(stop.estimated_arrival).toLocaleTimeString()}
                </Text>
              )}
            </View>
            {nextStopInfo?.next_stop.id === stop.id && (
              <Text style={styles.nextIndicator}>NEXT</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ef4444',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: '#6b7280',
    padding: 12,
    borderRadius: 8,
    minWidth: 100,
  },
  closeButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#3B82F6',
    padding: 16,
    paddingTop: 50, // Account for status bar
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  headerCloseButton: {
    padding: 8,
  },
  headerCloseText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerInfoText: {
    color: 'white',
    fontSize: 12,
    opacity: 0.9,
  },
  map: {
    flex: 1,
  },
  nextStopContainer: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  nextStopTitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  nextStopName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  nextStopDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nextStopDetailText: {
    fontSize: 14,
    color: '#475569',
  },
  stopsContainer: {
    maxHeight: 200,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  stopsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    padding: 16,
    paddingBottom: 8,
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  nextStopItem: {
    backgroundColor: '#fef3c7',
  },
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stopNumberText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
  },
  stopTime: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  nextIndicator: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f59e0b',
  },
  mapToggleButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  mapToggleText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default RouteMap;
