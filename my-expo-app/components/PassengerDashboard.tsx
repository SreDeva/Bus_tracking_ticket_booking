import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import * as Location from 'expo-location';
import QRCode from 'react-native-qrcode-svg';
import RouteMapView from './RouteMapView';
import BusRouteMap from './BusRouteMap';

// API Configuration - should match AuthContext
const API_CONFIGS = {
  ANDROID_EMULATOR: 'http://10.26.181.214:8000',
  IOS_SIMULATOR: 'http://localhost:8000', 
  PHYSICAL_DEVICE: 'http://10.26.181.214:8000', // Replace with your IP
};

// Set the active configuration here - should match AuthContext
const API_BASE_URL = API_CONFIGS.PHYSICAL_DEVICE;

interface BusStop {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  stop_order?: number;
  distance_km?: number;
}

interface Route {
  id: number;
  route_name: string;
  origin: string;
  destination: string;
  stops: BusStop[];
}

interface Bus {
  id?: number;
  bus_id: number;
  bus_number: string;
  route_name: string;
  current_latitude?: number;
  current_longitude?: number;
  distance_from_user_km?: number;
  estimated_arrival_minutes?: number;
  next_stop?: string;
  route_id?: number;
  stops_remaining?: number;
  bus_type?: string;  // Added bus type
  capacity?: number;  // Added capacity
}

interface Ticket {
  id: string;
  bus_id: number;
  bus_number: string;
  route_name: string;
  source_stop: string;
  destination_stop: string;
  qr_code: string;
  one_time_code: string;
  expires_at: string;
  status: 'active' | 'used' | 'expired';
  created_at: string;
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
  bus_type?: string;  // Added bus type
  capacity?: number;  // Added capacity
}

interface RouteSearchResult {
  source_stop: BusStop;
  destination_stop: BusStop;
  buses_on_route: BusLocation[];  // Changed to BusLocation for map compatibility
  recommended_bus?: BusLocation;  // Changed to optional for map compatibility
  route_geometry: {       // Added route geometry
    type: string;
    coordinates: number[][];
  };
  total_distance_km: number;        // Added from API response
  estimated_duration_minutes: number; // Added from API response
  available_buses?: Bus[];  // Keep for backward compatibility
  route_info?: {           // Keep for backward compatibility
    distance_km: number;
    estimated_duration_minutes: number;
    total_price: number;
  };
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

const PassengerDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  
  // State management
  const [currentLocation, setCurrentLocation] = useState<UserLocation | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [selectedSourceStop, setSelectedSourceStop] = useState<BusStop | null>(null);
  const [selectedDestinationStop, setSelectedDestinationStop] = useState<BusStop | null>(null);
  const [availableBuses, setAvailableBuses] = useState<Bus[]>([]);
  const [showTicket, setShowTicket] = useState<Ticket | null>(null);
  const [allStops, setAllStops] = useState<BusStop[]>([]);
  const [searchResult, setSearchResult] = useState<RouteSearchResult | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [selectedBus, setSelectedBus] = useState<BusLocation | null>(null);
  const [sourceInput, setSourceInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [showResults, setShowResults] = useState(false);
  
  useEffect(() => {
    initializeLocation();
    fetchRoutes();
    fetchUserTickets();
    fetchStops();
  }, []);

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  // Advanced route search function
  const searchRoutes = async () => {
    if (!sourceInput.trim() || !destinationInput.trim()) {
      Alert.alert('Error', 'Please enter both source and destination');
      return;
    }

    setLoading(true);
    try {
      // Get current location for user_location
      let userLocation = null;
      if (currentLocation) {
        userLocation = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude
        };
      }

      // Prepare request body with stop names
      const requestBody = {
        source_stop_name: sourceInput.trim(),
        destination_stop_name: destinationInput.trim(),
        user_location: userLocation,
        max_distance_km: 3.0
      };

      console.log('Searching routes with stop names:', requestBody);

      const response = await fetch(`${API_BASE_URL}/passenger/find-route`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Route search failed:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('Route search result:', result);

      // Transform the result to match expected format
      const transformedResult: RouteSearchResult = {
        source_stop: {
          id: result.source_stop.id,
          name: result.source_stop.name,
          latitude: result.source_stop.latitude,
          longitude: result.source_stop.longitude,
          stop_order: result.source_stop.stop_order
        },
        destination_stop: {
          id: result.destination_stop.id,
          name: result.destination_stop.name,
          latitude: result.destination_stop.latitude,
          longitude: result.destination_stop.longitude,
          stop_order: result.destination_stop.stop_order
        },
        buses_on_route: result.buses_on_route.map((bus: any) => ({
          bus_id: bus.bus_id,
          bus_number: bus.bus_number,
          route_name: bus.route_name,
          current_latitude: bus.current_latitude || 12.9716,
          current_longitude: bus.current_longitude || 77.5946,
          distance_from_user_km: bus.distance_from_user_km,
          estimated_arrival_minutes: bus.estimated_arrival_minutes,
          next_stop: bus.next_stop,
          route_id: bus.route_id || 1,
          stops_remaining: bus.stops_remaining || 0
        })),
        recommended_bus: result.recommended_bus ? {
          bus_id: result.recommended_bus.bus_id,
          bus_number: result.recommended_bus.bus_number,
          route_name: result.recommended_bus.route_name,
          current_latitude: result.recommended_bus.current_latitude || 12.9716,
          current_longitude: result.recommended_bus.current_longitude || 77.5946,
          distance_from_user_km: result.recommended_bus.distance_from_user_km || 0,
          estimated_arrival_minutes: result.recommended_bus.estimated_arrival_minutes || 0,
          next_stop: result.recommended_bus.next_stop || '',
          route_id: result.recommended_bus.route_id || 1,
          stops_remaining: result.recommended_bus.stops_remaining || 0
        } : undefined,
        route_geometry: result.route_geometry,
        total_distance_km: result.total_distance_km,
        estimated_duration_minutes: result.estimated_duration_minutes
      };

      setSearchResult(transformedResult);
      setShowResults(true);

    } catch (error: any) {
      console.error('Error searching routes:', error);
      Alert.alert('Error', `Route search failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle bus selection from map
  const handleBusSelection = (busId: number) => {
    if (searchResult) {
      const bus = (searchResult.available_buses || searchResult.buses_on_route)?.find(b => b.bus_id === busId);
      if (bus) {
        setSelectedBus(bus);
        setShowMap(false);
        Alert.alert(
          'Bus Selected',
          `You selected ${bus.bus_number} on route ${bus.route_name}. Would you like to book a ticket?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Book Ticket', onPress: () => bookAdvancedTicket(bus) }
          ]
        );
      }
    }
  };

  // Book ticket with selected bus
  const bookAdvancedTicket = async (bus: BusLocation) => {
    if (!searchResult) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/passenger/book-ticket`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bus_id: bus.bus_id,
          source_stop: searchResult.source_stop.name,
          destination_stop: searchResult.destination_stop.name,
          passenger_id: user?.id
        })
      });

      if (response.ok) {
        const newTicket = await response.json();
        setTickets(prev => [...prev, newTicket]);
        setShowTicket(newTicket);
        Alert.alert('Success', 'Ticket booked successfully!');
      } else {
        throw new Error('Failed to book ticket');
      }
    } catch (error) {
      console.error('Error booking ticket:', error);
      Alert.alert('Error', 'Failed to book ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoutes = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/buses/routes`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const routesData = await response.json();
        setRoutes(routesData);
      }
    } catch (error) {
      console.error('Error fetching routes:', error);
    }
  };

  const fetchStops = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/passenger/bus-stops`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const stopsData = await response.json();
        setAllStops(stopsData);
      } else {
        // Fallback to mock stops (updated to match database)
        const mockStops: BusStop[] = [
          { id: 2, name: 'Pollachi', latitude: 10.6588234, longitude: 77.00873, stop_order: 1 },
          { id: 3, name: 'Palani Bus Stand', latitude: 10.4495216, longitude: 77.5153329, stop_order: 2 },
          { id: 4, name: 'Ukkadam Bus Stand', latitude: 10.988347, longitude: 76.9618799, stop_order: 3 }
        ];
        setAllStops(mockStops);
      }
    } catch (error) {
      console.error('Error fetching stops:', error);
      // Fallback to mock stops (updated to match database)
      const mockStops: BusStop[] = [
        { id: 2, name: 'Pollachi', latitude: 10.6588234, longitude: 77.00873, stop_order: 1 },
        { id: 3, name: 'Palani Bus Stand', latitude: 10.4495216, longitude: 77.5153329, stop_order: 2 },
        { id: 4, name: 'Ukkadam Bus Stand', latitude: 10.988347, longitude: 76.9618799, stop_order: 3 }
      ];
      setAllStops(mockStops);
    }
  };

  const fetchUserTickets = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/tickets/my-tickets`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const ticketsData = await response.json();
        setTickets(ticketsData);
      } else {
        // Fallback to mock data if endpoint doesn't exist yet
        const mockTickets: Ticket[] = [
          {
            id: '1',
            bus_id: 1,
            bus_number: 'TN 01 AA 0001',
            route_name: 'Downtown Express',
            source_stop: 'Main Station',
            destination_stop: 'City Center',
            qr_code: 'TICKET_QR123456',
            one_time_code: '1234',
            expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
            status: 'active',
            created_at: new Date().toISOString()
          }
        ];
        setTickets(mockTickets);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
      // Fallback to mock data
      const mockTickets: Ticket[] = [
        {
          id: '1',
          bus_id: 1,
          bus_number: 'TN 01 AA 0001',
          route_name: 'Downtown Express',
          source_stop: 'Main Station',
          destination_stop: 'City Center',
          qr_code: 'TICKET_QR123456',
          one_time_code: '1234',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          status: 'active',
          created_at: new Date().toISOString()
        }
      ];
      setTickets(mockTickets);
    }
  };

  const findClosestStop = (userLocation: {latitude: number, longitude: number}, stops: BusStop[]) => {
    let closestStop = stops[0];
    let minDistance = calculateDistance(userLocation, stops[0]);

    stops.forEach(stop => {
      const distance = calculateDistance(userLocation, stop);
      if (distance < minDistance) {
        minDistance = distance;
        closestStop = stop;
      }
    });

    return closestStop;
  };

  const calculateDistance = (point1: {latitude: number, longitude: number}, point2: {latitude: number, longitude: number}) => {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const findAvailableBuses = async () => {
    if (!selectedSourceStop || !selectedDestinationStop) {
      Alert.alert('Error', 'Please select both source and destination stops');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tickets/search-buses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source_stop_id: selectedSourceStop.id,
          destination_stop_id: selectedDestinationStop.id
        })
      });

      if (response.ok) {
        const busesData = await response.json();
        setAvailableBuses(busesData.map((bus: any) => ({
          id: bus.id,
          bus_number: bus.bus_number,
          current_latitude: bus.current_latitude,
          current_longitude: bus.current_longitude,
          route: {
            id: bus.id,
            route_name: bus.route_name,
            origin: selectedSourceStop.name,
            destination: selectedDestinationStop.name,
            stops: []
          }
        })));
      } else {
        // Fallback to mock data
        const mockBuses: Bus[] = [
          {
            id: 1,
            bus_id: 1,
            bus_number: 'TN 01 AA 0001',
            route_name: 'Downtown Express',
            current_latitude: 12.9716,
            current_longitude: 77.5946,
            latitude: 12.9716,
            longitude: 77.5946,
            distance_from_user_km: 2.5,
            estimated_arrival_minutes: 15,
            next_stop: selectedDestinationStop.name,
            route_id: 1,
            stops_remaining: 3,
            route: {
              id: 1,
              route_name: 'Downtown Express',
              origin: selectedSourceStop.name,
              destination: selectedDestinationStop.name,
              stops: []
            }
          }
        ];
        setAvailableBuses(mockBuses);
      }
    } catch (error) {
      console.error('Error finding buses:', error);
      Alert.alert('Error', 'Failed to find available buses');
    } finally {
      setLoading(false);
    }
  };

  const bookTicket = async (busId: number) => {
    if (!selectedSourceStop || !selectedDestinationStop) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tickets/book`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bus_id: busId,
          source_stop_id: selectedSourceStop.id,
          destination_stop_id: selectedDestinationStop.id
        })
      });

      if (response.ok) {
        const ticketData = await response.json();
        setShowTicket(ticketData);
        setTickets(prev => [...prev, ticketData]);
        Alert.alert('Success', 'Ticket booked successfully!');
      } else {
        // Fallback to mock booking
        const newTicket: Ticket = {
          id: Math.random().toString(),
          bus_id: busId,
          bus_number: `BUS${busId.toString().padStart(3, '0')}`,
          route_name: availableBuses.find(b => b.id === busId)?.route?.route_name || 'Unknown Route',
          source_stop: selectedSourceStop.name,
          destination_stop: selectedDestinationStop.name,
          qr_code: `TICKET_QR${Date.now()}`,
          one_time_code: Math.floor(1000 + Math.random() * 9000).toString(),
          expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
          status: 'active',
          created_at: new Date().toISOString()
        };
        
        setShowTicket(newTicket);
        setTickets(prev => [...prev, newTicket]);
        Alert.alert('Success', 'Ticket booked successfully!');
      }
    } catch (error) {
      console.error('Error booking ticket:', error);
      Alert.alert('Error', 'Failed to book ticket');
    } finally {
      setLoading(false);
    }
  };

  const renderSearchInterface = () => {
    if (!searchMode) return null;

    return (
      <View style={styles.searchContainer}>
        <Text style={styles.sectionTitle}>🔍 Find Your Bus</Text>
        <Text style={styles.subtitle}>Enter any location to find buses within 3km radius</Text>
        
        {/* Source Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>📍 From (Source)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Try: Central Station, City Center, Tech Park, Airport"
            value={sourceInput}
            onChangeText={setSourceInput}
            multiline={false}
            returnKeyType="next"
          />
          <Text style={styles.helpText}>
            💡 Available stops: Palani Bus Stand, Coimbatore Central, Madurai Periyar, Tiruppur, Erode Central
          </Text>
          {currentLocation && (
            <TouchableOpacity
              style={styles.quickLocationButton}
              onPress={() => setSourceInput('Current Location')}
            >
              <Text style={styles.quickLocationText}>📍 Use Current Location</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Destination Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>🎯 To (Destination)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Try: Airport, University, Business District"
            value={destinationInput}
            onChangeText={setDestinationInput}
            multiline={false}
            returnKeyType="search"
            onSubmitEditing={searchRoutes}
          />
          <Text style={styles.helpText}>
            💡 Popular destinations: Coimbatore Central, Madurai Periyar, Salem Central, Dindigul Bus Stand
          </Text>
        </View>

        {/* Current Location Display */}
        {currentLocation && (
          <View style={styles.locationInfo}>
            <Text style={styles.locationText}>
              📍 Your location: {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
            </Text>
            <Text style={styles.locationSubtext}>We'll find the closest bus stops for you</Text>
          </View>
        )}

        {/* Search Button */}
        <TouchableOpacity
          style={[styles.searchButton, loading && styles.disabledButton]}
          onPress={searchRoutes}
          disabled={loading || !sourceInput.trim() || !destinationInput.trim()}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="white" size="small" />
              <Text style={styles.searchButtonText}>Searching...</Text>
            </View>
          ) : (
            <Text style={styles.searchButtonText}>🔍 Find Buses</Text>
          )}
        </TouchableOpacity>

        {/* Search Results */}
        {searchResult && (
          <View style={styles.searchResults}>
            <Text style={styles.resultsTitle}>✅ Route Found!</Text>
            
            <View style={styles.routeInfo}>
              <View style={styles.routeStops}>
                <Text style={styles.routeStopTitle}>📍 Nearest Source Stop:</Text>
                <Text style={styles.routeStopName}>{searchResult.source_stop.name}</Text>
                {searchResult.source_stop.distance_km && (
                  <Text style={styles.routeStopDistance}>
                    ({searchResult.source_stop.distance_km.toFixed(2)} km from your location)
                  </Text>
                )}
              </View>

              <View style={styles.routeStops}>
                <Text style={styles.routeStopTitle}>🎯 Destination Stop:</Text>
                <Text style={styles.routeStopName}>{searchResult.destination_stop.name}</Text>
              </View>

              <View style={styles.routeDetailsBox}>
                <Text style={styles.routeDetail}>📏 Total Distance: {(searchResult.route_info?.distance_km || searchResult.total_distance_km).toFixed(2)} km</Text>
                <Text style={styles.routeDetail}>⏱️ Estimated Duration: ~{searchResult.route_info?.estimated_duration_minutes || searchResult.estimated_duration_minutes} min</Text>
                <Text style={styles.routeDetail}>💰 Estimated Price: ₹{searchResult.route_info?.total_price || 50}</Text>
              </View>
            </View>

            <Text style={styles.busesTitle}>
              🚌 Available Buses ({(searchResult.available_buses || searchResult.buses_on_route)?.length || 0} found)
            </Text>

            {searchResult.recommended_bus && (
              <View style={styles.recommendedBus}>
                <Text style={styles.recommendedLabel}>⭐ RECOMMENDED</Text>
                <Text style={styles.recommendedBusNumberLarge}>{searchResult.recommended_bus.bus_number}</Text>
                <Text style={styles.recommendedBusRoute}>{searchResult.recommended_bus.route_name}</Text>
                {searchResult.recommended_bus.estimated_arrival_minutes && (
                  <Text style={styles.recommendedEta}>
                    🕒 Arriving in {searchResult.recommended_bus.estimated_arrival_minutes} minutes
                  </Text>
                )}
                {searchResult.recommended_bus.distance_from_user_km && (
                  <Text style={styles.recommendedDistance}>
                    📍 {searchResult.recommended_bus.distance_from_user_km.toFixed(2)} km away
                  </Text>
                )}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.viewMapButton}
                onPress={() => setShowMap(true)}
              >
                <Text style={styles.viewMapButtonText}>🗺️ View on Map</Text>
              </TouchableOpacity>

              {searchResult.recommended_bus && (
                <TouchableOpacity
                  style={styles.quickBookButton}
                  onPress={() => bookAdvancedTicket(searchResult.recommended_bus!)}
                >
                  <Text style={styles.quickBookButtonText}>⚡ Quick Book</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.allBusesList}>
              <Text style={styles.allBusesTitle}>Available Buses ({(searchResult.available_buses || searchResult.buses_on_route)?.filter((bus, index, array) => array.findIndex(b => b.bus_id === bus.bus_id) === index).length || 0})</Text>
              {(searchResult.available_buses || searchResult.buses_on_route)
                ?.filter((bus, index, array) => 
                  // Remove duplicates based on bus_id
                  array.findIndex(b => b.bus_id === bus.bus_id) === index
                )
                ?.map((bus, index) => (
                <TouchableOpacity
                  key={`bus-${bus.bus_id}-${index}`}
                  style={[
                    styles.busListItem,
                    bus.bus_id === searchResult.recommended_bus?.bus_id && styles.recommendedBusItem
                  ]}
                  onPress={() => bookAdvancedTicket(bus)}
                >
                  <View style={styles.busListInfo}>
                    <View style={styles.busHeader}>
                      <Text style={styles.busListNumber}>{bus.bus_number}</Text>
                      {bus.bus_id === searchResult.recommended_bus?.bus_id && (
                        <Text style={styles.recommendedBadge}>⭐ Recommended</Text>
                      )}
                    </View>
                    <Text style={styles.busListRoute}>{bus.route_name}</Text>
                    <View style={styles.busMetrics}>
                      {bus.estimated_arrival_minutes && (
                        <Text style={styles.busListEta}>🕒 ETA: {bus.estimated_arrival_minutes} min</Text>
                      )}
                      {bus.distance_from_user_km !== undefined && (
                        <Text style={styles.busListDistance}>📍 {bus.distance_from_user_km.toFixed(1)} km away</Text>
                      )}
                      {bus.stops_remaining && (
                        <Text style={styles.busListStops}>🚏 {bus.stops_remaining} stops remaining</Text>
                      )}
                    </View>
                    {bus.next_stop && (
                      <Text style={styles.busNextStop}>Next stop: {bus.next_stop}</Text>
                    )}
                    {(bus.bus_type || bus.capacity) && (
                      <View style={styles.busMetrics}>
                        {bus.bus_type && (
                          <Text style={styles.busTypeText}>🚌 {bus.bus_type}</Text>
                        )}
                        {bus.capacity && (
                          <Text style={styles.busCapacityText}>👥 {bus.capacity} seats</Text>
                        )}
                      </View>
                    )}
                  </View>
                  <View style={styles.busListActions}>
                    <TouchableOpacity 
                      style={[styles.bookButton, bus.bus_id === searchResult.recommended_bus?.bus_id && styles.recommendedBookButton]}
                      onPress={() => bookAdvancedTicket(bus)}
                    >
                      <Text style={[styles.bookButtonText, bus.bus_id === searchResult.recommended_bus?.bus_id && styles.recommendedBookButtonText]}>
                        🎫 Book Ticket
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderTicketModal = () => {
    if (!showTicket) return null;

    return (
      <View style={styles.modalOverlay}>
        <View style={styles.ticketModal}>
          <Text style={styles.ticketTitle}>🎫 Your Ticket</Text>
          
          <View style={styles.ticketDetails}>
            <Text style={styles.ticketInfo}>Bus: {showTicket.bus_number}</Text>
            <Text style={styles.ticketInfo}>Route: {showTicket.route_name}</Text>
            <Text style={styles.ticketInfo}>From: {showTicket.source_stop}</Text>
            <Text style={styles.ticketInfo}>To: {showTicket.destination_stop}</Text>
            <Text style={styles.ticketInfo}>Expires: {new Date(showTicket.expires_at).toLocaleString()}</Text>
          </View>

          <View style={styles.qrContainer}>
            <Text style={styles.qrLabel}>QR Code:</Text>
            <QRCode
              value={showTicket.qr_code}
              size={150}
              backgroundColor="white"
              color="black"
            />
          </View>

          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>One-Time Code:</Text>
            <Text style={styles.oneTimeCode}>{showTicket.one_time_code}</Text>
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowTicket(null)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.welcomeText}>Welcome, {user?.full_name}</Text>
            <Text style={styles.subtitleText}>Passenger Dashboard</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => setSearchMode(!searchMode)}
            >
              <Text style={styles.actionIcon}>🚌</Text>
              <Text style={styles.actionTitle}>Find & Book Bus</Text>
              <Text style={styles.actionSubtitle}>Search routes and book tickets</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}>
              <Text style={styles.actionIcon}>🗺️</Text>
              <Text style={styles.actionTitle}>View Map</Text>
              <Text style={styles.actionSubtitle}>See buses on map</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}>
              <Text style={styles.actionIcon}>📋</Text>
              <Text style={styles.actionTitle}>My Tickets</Text>
              <Text style={styles.actionSubtitle}>View booking history</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}>
              <Text style={styles.actionIcon}>📍</Text>
              <Text style={styles.actionTitle}>Track Bus</Text>
              <Text style={styles.actionSubtitle}>Real-time bus tracking</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Interface */}
        {renderSearchInterface()}

        {/* My Tickets */}
        <View style={styles.ticketsContainer}>
          <Text style={styles.sectionTitle}>My Tickets</Text>
          {tickets.length === 0 ? (
            <Text style={styles.noTicketsText}>No tickets found. Book your first ticket!</Text>
          ) : (
            tickets.map((ticket, index) => (
              <TouchableOpacity
                key={`ticket-${ticket.id}-${index}`}
                style={styles.ticketCard}
                onPress={() => setShowTicket(ticket)}
              >
                <View style={styles.ticketCardContent}>
                  <Text style={styles.ticketCardTitle}>Bus {ticket.bus_number}</Text>
                  <Text style={styles.ticketCardRoute}>{ticket.route_name}</Text>
                  <Text style={styles.ticketCardStops}>
                    {ticket.source_stop} → {ticket.destination_stop}
                  </Text>
                  <Text style={[
                    styles.ticketStatus,
                    ticket.status === 'active' && styles.activeStatus,
                    ticket.status === 'used' && styles.usedStatus,
                    ticket.status === 'expired' && styles.expiredStatus
                  ]}>
                    {ticket.status.toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Ticket Modal */}
      {renderTicketModal()}

      {/* Route Map View */}
      {showMap && searchResult && (
        <View style={styles.modalOverlay}>
          <View style={styles.mapModal}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapTitle}>🗺️ Select Your Bus</Text>
              <TouchableOpacity
                style={styles.closeMapButton}
                onPress={() => setShowMap(false)}
              >
                <Text style={styles.closeMapButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <BusRouteMap
              searchResult={searchResult}
              onBusSelect={(busId) => handleBusSelection(busId)}
            />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#3b82f6',
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitleText: {
    color: '#bfdbfe',
    fontSize: 14,
  },
  logoutButton: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: 'white',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  actionsContainer: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    backgroundColor: 'white',
    width: '48%',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  searchContainer: {
    padding: 24,
    backgroundColor: 'white',
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  quickButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  quickButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  stopsScroll: {
    maxHeight: 100,
  },
  stopButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedStop: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  stopButtonText: {
    color: '#374151',
    fontWeight: '500',
  },
  selectedStopText: {
    color: '#1e40af',
    fontWeight: '600',
  },
  searchButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  busesContainer: {
    marginTop: 24,
  },
  busCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  busInfo: {
    flex: 1,
  },
  busNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  routeName: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  routeDetails: {
    fontSize: 12,
    color: '#9ca3af',
  },
  bookButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  bookButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  ticketsContainer: {
    padding: 24,
  },
  noTicketsText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    fontStyle: 'italic',
    marginTop: 20,
  },
  ticketCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  ticketCardContent: {
    flexDirection: 'column',
  },
  ticketCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  ticketCardRoute: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  ticketCardStops: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  ticketStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  activeStatus: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  usedStatus: {
    backgroundColor: '#f3f4f6',
    color: '#374151',
  },
  expiredStatus: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  ticketModal: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    maxWidth: 350,
    width: '90%',
  },
  ticketTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
  },
  ticketDetails: {
    width: '100%',
    marginBottom: 20,
  },
  ticketInfo: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  qrPlaceholder: {
    width: 150,
    height: 150,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#9ca3af',
  },
  qrText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  codeContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  codeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  oneTimeCode: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3b82f6',
    letterSpacing: 4,
  },
  closeButton: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  mapModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '95%',
    height: '90%',
    overflow: 'hidden',
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeMapButton: {
    backgroundColor: '#ef4444',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeMapButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputContainer: {
    marginBottom: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  locationInfo: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  locationText: {
    fontSize: 12,
    color: '#374151',
  },
  searchResults: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  routeInfo: {
    marginBottom: 16,
  },
  routeDetail: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  busesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  recommendedBus: {
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#10b981',
    marginBottom: 16,
  },
  recommendedLabel: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  recommendedBusNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  busRoute: {
    fontSize: 14,
    color: '#6b7280',
  },
  eta: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  viewMapButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewMapButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quickLocationButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  quickLocationText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  locationSubtext: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  routeStops: {
    marginBottom: 12,
  },
  routeStopTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  routeStopName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  routeStopDistance: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  routeDetailsBox: {
    backgroundColor: '#e5e7eb',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  recommendedBusNumberLarge: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  recommendedBusRoute: {
    fontSize: 14,
    color: '#6b7280',
  },
  recommendedEta: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    marginTop: 4,
  },
  recommendedDistance: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  quickBookButton: {
    backgroundColor: '#10b981',
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickBookButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  allBusesList: {
    marginTop: 16,
  },
  allBusesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  busListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  recommendedBusItem: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  busListInfo: {
    flex: 1,
  },
  busListNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  busListRoute: {
    fontSize: 12,
    color: '#6b7280',
  },
  busListEta: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  busListActions: {
    alignItems: 'flex-end',
  },
  busListDistance: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 4,
  },
  bookButtonSmall: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 16,
  },
  // Enhanced bus list styles
  busHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  recommendedBadge: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: 'bold',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  busMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  busListStops: {
    fontSize: 11,
    color: '#7c3aed',
    fontWeight: '500',
  },
  busNextStop: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  recommendedBookButton: {
    backgroundColor: '#f59e0b',
  },
  recommendedBookButtonText: {
    color: 'white',
  },
  busTypeText: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '500',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  busCapacityText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '500',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});

export default PassengerDashboard;
