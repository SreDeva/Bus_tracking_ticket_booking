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
import { WebView } from 'react-native-webview';
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
  stop_order?: number;
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
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Location Error', 'Unable to get your current location');
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
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch nearby buses`);
      }

      const data = await response.json();
      setNearbyBuses(data.nearby_buses || []);
    } catch (error) {
      console.error('Failed to fetch nearby buses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBusStops = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/passenger/bus-stops`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBusStops(data.stops || []);
      }
    } catch (error) {
      console.error('Failed to fetch bus stops:', error);
    }
  };

  const getMapRegion = () => {
    if (searchResult) {
      const { source_stop, destination_stop } = searchResult;
      const midLat = (source_stop.latitude + destination_stop.latitude) / 2;
      const midLng = (source_stop.longitude + destination_stop.longitude) / 2;
      
      const latDelta = Math.abs(source_stop.latitude - destination_stop.latitude) * 1.5;
      const lngDelta = Math.abs(source_stop.longitude - destination_stop.longitude) * 1.5;

      return {
        latitude: midLat,
        longitude: midLng,
        latitudeDelta: Math.max(latDelta, 0.05),
        longitudeDelta: Math.max(lngDelta, 0.05),
      };
    }

    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    // Default to Coimbatore area
    return {
      latitude: 11.0168,
      longitude: 76.9558,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  };

  const generateMapHTML = () => {
    const region = getMapRegion();
    const busesToShow = searchResult ? searchResult.buses_on_route : nearbyBuses;
    const stopsToShow = searchResult 
      ? [searchResult.source_stop, searchResult.destination_stop]
      : busStops;

    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bus Route Map</title>
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <style>
              body { margin: 0; padding: 0; }
              #map { height: 100vh; width: 100%; }
              .loading {
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  font-family: Arial, sans-serif;
                  color: #666;
                  z-index: 1000;
              }
          </style>
      </head>
      <body>
          <div class="loading" id="loading">Loading map...</div>
          <div id="map"></div>
          <script>
              try {
                  // Hide loading message
                  document.getElementById('loading').style.display = 'none';
                  
                  // Initialize map
                  const map = L.map('map').setView([${region.latitude}, ${region.longitude}], 13);
              
                  // Add OpenStreetMap tiles
                  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                      attribution: '© OpenStreetMap contributors',
                      maxZoom: 19
                  }).addTo(map);
                  
                  // Add bus stops
                  const stops = ${JSON.stringify(stopsToShow)};
                  stops.forEach((stop, index) => {
                      if (stop.latitude && stop.longitude) {
                          const marker = L.marker([stop.latitude, stop.longitude], {
                              icon: L.icon({
                                  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
                                  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                                  iconSize: [25, 41],
                                  iconAnchor: [12, 41],
                                  popupAnchor: [1, -34],
                                  shadowSize: [41, 41]
                              })
                          }).addTo(map)
                          .bindPopup('<b>' + stop.name + '</b><br>Bus Stop #' + (stop.stop_order || (index + 1)));
                      }
                  });

                  // Add buses
                  const buses = ${JSON.stringify(busesToShow)};
                  buses.forEach((bus, index) => {
                      if (bus.current_latitude && bus.current_longitude) {
                          const isRecommended = ${searchResult?.recommended_bus ? 
                            `bus.bus_id === ${searchResult.recommended_bus.bus_id}` : 'false'};
                          const iconColor = isRecommended ? 'red' : 'green';
                          
                          const marker = L.marker([bus.current_latitude, bus.current_longitude], {
                              icon: L.icon({
                                  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-' + iconColor + '.png',
                                  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                                  iconSize: [25, 41],
                                  iconAnchor: [12, 41],
                                  popupAnchor: [1, -34],
                                  shadowSize: [41, 41]
                              })
                          }).addTo(map)
                          .bindPopup('<b>' + bus.bus_number + '</b><br>' + 
                                   bus.route_name + '<br>' +
                                   'ETA: ' + bus.estimated_arrival_minutes + ' min<br>' +
                                   'Distance: ' + bus.distance_from_user_km + ' km' +
                                   (isRecommended ? '<br><b>⭐ Recommended</b>' : ''));

                          // Add click handler for bus selection
                          marker.on('click', function() {
                              window.ReactNativeWebView?.postMessage(JSON.stringify({
                                  type: 'busSelected',
                                  busId: bus.bus_id
                              }));
                          });
                      }
                  });

                  // Add user location if available
                  ${userLocation ? `
                  L.marker([${userLocation.latitude}, ${userLocation.longitude}], {
                      icon: L.icon({
                          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
                          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                          iconSize: [25, 41],
                          iconAnchor: [12, 41],
                          popupAnchor: [1, -34],
                          shadowSize: [41, 41]
                      })
                  }).addTo(map).bindPopup('<b>Your Location</b>');
                  ` : ''}

                  // Draw route line if available
                  ${searchResult && searchResult.route_geometry ? `
                  const routeGeometry = ${JSON.stringify(searchResult.route_geometry)};
                  if (routeGeometry && routeGeometry.coordinates && routeGeometry.coordinates.length > 0) {
                      const coordinates = routeGeometry.coordinates.map(coord => [coord[1], coord[0]]);
                      L.polyline(coordinates, {
                          color: 'blue', 
                          weight: 4, 
                          opacity: 0.8
                      }).addTo(map);
                  } else {
                      // Fallback: draw straight line between stops
                      const straightLine = [
                          [${searchResult.source_stop.latitude}, ${searchResult.source_stop.longitude}],
                          [${searchResult.destination_stop.latitude}, ${searchResult.destination_stop.longitude}]
                      ];
                      L.polyline(straightLine, {
                          color: 'red', 
                          weight: 3, 
                          opacity: 0.6,
                          dashArray: '5, 10'
                      }).addTo(map);
                  }
                  ` : ''}

                  // Add search radius circle if showing nearby buses
                  ${!searchResult && userLocation ? `
                  L.circle([${userLocation.latitude}, ${userLocation.longitude}], {
                      color: 'blue',
                      fillColor: '#30a8ff',
                      fillOpacity: 0.1,
                      radius: ${searchRadius * 1000} // Convert km to meters
                  }).addTo(map);
                  ` : ''}

                  console.log('Map initialized successfully');
                  
              } catch (error) {
                  console.error('Map initialization error:', error);
                  document.body.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">Map failed to load: ' + error.message + '</div>';
              }
          </script>
      </body>
      </html>
    `;
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'busSelected' && onBusSelect) {
        onBusSelect(data.busId);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Map Section */}
      <View style={styles.mapContainer}>
        <WebView
          style={styles.map}
          source={{ html: generateMapHTML() }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0066cc" />
              <Text style={styles.loadingText}>Loading Map...</Text>
            </View>
          )}
        />
      </View>

      {/* Bus List Section */}
      {(searchResult?.buses_on_route?.length || nearbyBuses.length) > 0 && (
        <View style={styles.busListContainer}>
          <Text style={styles.busListTitle}>
            {searchResult ? 'Buses on Route' : 'Nearby Buses'}
          </Text>
          <ScrollView style={styles.busList} showsVerticalScrollIndicator={false}>
            {(searchResult?.buses_on_route || nearbyBuses).map((bus) => (
              <TouchableOpacity
                key={bus.bus_id}
                style={[
                  styles.busItem,
                  selectedBus?.bus_id === bus.bus_id && styles.selectedBusItem,
                  searchResult?.recommended_bus?.bus_id === bus.bus_id && styles.recommendedBusItem
                ]}
                onPress={() => {
                  setSelectedBus(bus);
                  onBusSelect?.(bus.bus_id);
                }}
              >
                <View style={styles.busHeader}>
                  <Text style={styles.busNumber}>{bus.bus_number}</Text>
                  {searchResult?.recommended_bus?.bus_id === bus.bus_id && (
                    <Text style={styles.recommendedBadge}>⭐ Recommended</Text>
                  )}
                </View>
                <Text style={styles.busRoute}>{bus.route_name}</Text>
                <View style={styles.busDetails}>
                  <Text style={styles.busDistance}>
                    📍 {bus.distance_from_user_km} km away
                  </Text>
                  <Text style={styles.busEta}>
                    ⏱️ ETA: {bus.estimated_arrival_minutes} min
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Loading buses...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  mapContainer: {
    flex: 0.6,
    backgroundColor: '#e0e0e0',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  busListContainer: {
    flex: 0.4,
    backgroundColor: '#fff',
    paddingTop: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  busListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  busList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  busItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  selectedBusItem: {
    borderColor: '#007bff',
    backgroundColor: '#e7f3ff',
  },
  recommendedBusItem: {
    borderColor: '#ffc107',
    backgroundColor: '#fff8e1',
  },
  busHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  busNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  recommendedBadge: {
    fontSize: 12,
    color: '#ff6f00',
    fontWeight: 'bold',
  },
  busRoute: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  busDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  busDistance: {
    fontSize: 12,
    color: '#666',
  },
  busEta: {
    fontSize: 12,
    color: '#007bff',
    fontWeight: '500',
  },
});

export default BusRouteMap;
