import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';

// API Configuration
const API_BASE_URL = 'http://10.26.181.214:8000';
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';

// API Configuration
const API_BASE_URL = 'http://10.26.181.214:8000';

const { width, height } = Dimensions.get('window');

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface BusLocation {
  bus_id: number;
  bus_number: string;
  current_latitude: number;
  current_longitude: number;
  distance_from_user_km: number;
  estimated_arrival_minutes: number;
  route_id: number;
  route_name: string;
  next_stop: string;
  stops_remaining: number;
}

interface BusStop {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  stop_order?: number;  // Made optional to match API response
  distance_km?: number;
}

interface RouteGeometry {
  type: string;
  coordinates: number[][];
}

interface RouteSearchResult {
  source_stop: BusStop;
  destination_stop: BusStop;
  buses_on_route: BusLocation[];
  route_geometry: RouteGeometry;
  total_distance_km: number;
  estimated_duration_minutes: number;
  recommended_bus?: BusLocation;
}

interface Props {
  searchResult?: RouteSearchResult;
  onBusSelect?: (busId: number) => void;
}

const BusRouteMap: React.FC<Props> = ({ searchResult, onBusSelect }) => {
  const { token } = useAuth();
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [nearbyBuses, setNearbyBuses] = useState<BusLocation[]>([]);
  const [busStops, setBusStops] = useState<BusStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBus, setSelectedBus] = useState<BusLocation | null>(null);
  const [searchRadius] = useState(3.0); // 3km radius
  const [mapError, setMapError] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    initializeLocation();
  }, []);

  useEffect(() => {
    if (userLocation && !searchResult) {
      fetchNearbyBuses();
      fetchBusStops();
    }
  }, [userLocation]);

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to show nearby buses');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your location');
    }
  };

  const fetchNearbyBuses = async () => {
    if (!userLocation) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/passenger/nearby-buses?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}&max_distance_km=${searchRadius}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setNearbyBuses(data.buses || []);
      } else {
        console.error('Failed to fetch nearby buses:', response.status);
      }
    } catch (error) {
      console.error('Error fetching nearby buses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBusStops = async () => {
    if (!userLocation) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/passenger/bus-stops?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (response.ok) {
        const stops = await response.json();
        setBusStops(stops);
      }
    } catch (error) {
      console.error('Error fetching bus stops:', error);
    }
  };

  const handleBusPress = (bus: BusLocation) => {
    setSelectedBus(bus);
    if (onBusSelect) {
      onBusSelect(bus.bus_id);
    }
  };

  const getMapRegion = () => {
    if (searchResult) {
      // If we have search results, show the route area
      const coordinates = searchResult.route_geometry.coordinates;
      let minLat = coordinates[0][1];
      let maxLat = coordinates[0][1];
      let minLng = coordinates[0][0];
      let maxLng = coordinates[0][0];

      coordinates.forEach(coord => {
        minLat = Math.min(minLat, coord[1]);
        maxLat = Math.max(maxLat, coord[1]);
        minLng = Math.min(minLng, coord[0]);
        maxLng = Math.max(maxLng, coord[0]);
      });

      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.2),
        longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.2),
      };
    } else if (userLocation) {
      // Show user location with search radius
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    // Default region (Tamil Nadu area)
    return {
      latitude: 10.7905,
      longitude: 78.7047,
      latitudeDelta: 2,
      longitudeDelta: 2,
    };
  };

  const renderRoutePolyline = () => {
    if (!searchResult) return null;

    // Check if we have proper route geometry
    if (!searchResult.route_geometry || !searchResult.route_geometry.coordinates || searchResult.route_geometry.coordinates.length < 2) {
      // Fallback: draw simple line between source and destination
      const sourceCoord = {
        latitude: searchResult.source_stop.latitude,
        longitude: searchResult.source_stop.longitude
      };
      const destCoord = {
        latitude: searchResult.destination_stop.latitude,
        longitude: searchResult.destination_stop.longitude
      };

      return (
        <Polyline
          coordinates={[sourceCoord, destCoord]}
          strokeColor="#FF6B35"
          strokeWidth={4}
          lineDashPattern={[5, 5]}
        />
      );
    }

    const coordinates = searchResult.route_geometry.coordinates.map(coord => ({
      latitude: coord[1],
      longitude: coord[0]
    }));

    return (
      <Polyline
        coordinates={coordinates}
        strokeColor="#007AFF"
        strokeWidth={4}
      />
    );
  };

  const renderSearchRadius = () => {
    if (!userLocation || searchResult) return null;

    return (
      <Circle
        center={userLocation}
        radius={searchRadius * 1000} // Convert km to meters
        strokeColor="rgba(0, 122, 255, 0.3)"
        fillColor="rgba(0, 122, 255, 0.1)"
        strokeWidth={2}
      />
    );
  };

  const busesToShow = searchResult ? searchResult.buses_on_route : nearbyBuses;

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        region={getMapRegion()}
        showsUserLocation={true}
        showsMyLocationButton={false}
        mapType="standard"
        showsCompass={false}
        showsScale={false}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
        loadingEnabled={true}
        loadingIndicatorColor="#007AFF"
        loadingBackgroundColor="#f5f5f5"
        onMapReady={() => {
          console.log('Map loaded successfully');
          setMapLoaded(true);
          setMapError(false);
        }}
        onRegionChangeComplete={(region) => {
          console.log('Map region changed:', region);
        }}
      >
        {/* Search radius circle */}
        {renderSearchRadius()}

        {/* Route polyline */}
        {renderRoutePolyline()}

        {/* User location marker */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title="Your Location"
            pinColor="blue"
          />
        )}

        {/* Bus markers */}
        {busesToShow.map((bus) => (
          <Marker
            key={bus.bus_id}
            coordinate={{
              latitude: bus.current_latitude,
              longitude: bus.current_longitude
            }}
            title={bus.bus_number}
            description={`${bus.route_name} - ETA: ${bus.estimated_arrival_minutes}min`}
            pinColor={selectedBus?.bus_id === bus.bus_id ? "red" : "green"}
            onPress={() => handleBusPress(bus)}
          />
        ))}

        {/* Bus stops markers */}
        {searchResult && (
          <>
            <Marker
              coordinate={{
                latitude: searchResult.source_stop.latitude,
                longitude: searchResult.source_stop.longitude
              }}
              title={searchResult.source_stop.name}
              description="Source Stop"
              pinColor="yellow"
            />
            <Marker
              coordinate={{
                latitude: searchResult.destination_stop.latitude,
                longitude: searchResult.destination_stop.longitude
              }}
              title={searchResult.destination_stop.name}
              description="Destination Stop"
              pinColor="orange"
            />
          </>
        )}

        {/* All bus stops for general view */}
        {!searchResult && busStops.map((stop) => (
          <Marker
            key={stop.id}
            coordinate={{
              latitude: stop.latitude,
              longitude: stop.longitude
            }}
            title={stop.name}
            description={stop.distance_km ? `${stop.distance_km.toFixed(1)}km away` : 'Bus Stop'}
            pinColor="purple"
          />
        ))}
      </MapView>

      {/* Map loading indicator */}
      {!mapLoaded && (
        <View style={styles.mapLoadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}

      {/* Loading indicator for bus data */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Finding nearby buses...</Text>
        </View>
      )}

      {/* Bus info panel */}
      {selectedBus && (
        <View style={styles.busInfoPanel}>
          <Text style={styles.busTitle}>{selectedBus.bus_number}</Text>
          <Text style={styles.busRoute}>{selectedBus.route_name}</Text>
          <Text style={styles.busDistance}>
            Distance: {selectedBus.distance_from_user_km?.toFixed(1)}km
          </Text>
          <Text style={styles.busETA}>
            ETA: {selectedBus.estimated_arrival_minutes} minutes
          </Text>
          <Text style={styles.busStops}>
            Stops remaining: {selectedBus.stops_remaining}
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedBus(null)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Map Legend</Text>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: 'blue' }]} />
          <Text style={styles.legendText}>Your Location</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: 'green' }]} />
          <Text style={styles.legendText}>Available Buses</Text>
        </View>
        {searchResult && (
          <>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: 'yellow' }]} />
              <Text style={styles.legendText}>Source Stop</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: 'orange' }]} />
              <Text style={styles.legendText}>Destination Stop</Text>
            </View>
          </>
        )}
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: 'purple' }]} />
          <Text style={styles.legendText}>Bus Stops</Text>
        </View>
      </View>

      {/* Refresh button */}
      <TouchableOpacity
        style={styles.refreshButton}
        onPress={() => {
          fetchNearbyBuses();
          fetchBusStops();
        }}
      >
        <Text style={styles.refreshButtonText}>🔄 Refresh</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: width,
    height: height - 100,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
  },
  busInfoPanel: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  busTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  busRoute: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  busDistance: {
    fontSize: 14,
    color: '#888',
    marginTop: 3,
  },
  busETA: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 3,
    fontWeight: '600',
  },
  busStops: {
    fontSize: 14,
    color: '#888',
    marginTop: 3,
  },
  closeButton: {
    marginTop: 10,
    backgroundColor: '#ff4444',
    padding: 8,
    borderRadius: 5,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  legend: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 10,
    borderRadius: 8,
    minWidth: 120,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 10,
    flex: 1,
  },
  refreshButton: {
    position: 'absolute',
    top: 50,
    left: 10,
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default BusRouteMap;
