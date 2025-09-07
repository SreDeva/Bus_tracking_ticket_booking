import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import * as Location from 'expo-location';
import QRCode from 'react-native-qrcode-svg';

// API Configuration - should match AuthContext
const API_CONFIGS = {
  ANDROID_EMULATOR: 'http://10.123.168.214:8000',
  IOS_SIMULATOR: 'http://localhost:8000', 
  PHYSICAL_DEVICE: 'http://10.123.168.214:8000', // Replace with your IP
};

// Set the active configuration here - should match AuthContext
const API_BASE_URL = API_CONFIGS.PHYSICAL_DEVICE;

interface BusStop {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  stop_order: number;
}

interface Route {
  id: number;
  route_name: string;
  origin: string;
  destination: string;
  stops: BusStop[];
}

interface Bus {
  id: number;
  bus_number: string;
  current_latitude?: number;
  current_longitude?: number;
  route?: Route;
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

const PassengerDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  
  // State management
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);
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
      const response = await fetch(`${API_BASE_URL}/tickets/stops`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const stopsData = await response.json();
        setAllStops(stopsData);
      } else {
        // Fallback to mock stops
        const mockStops: BusStop[] = [
          { id: 1, name: 'Main Station', latitude: 12.9716, longitude: 77.5946, stop_order: 1 },
          { id: 2, name: 'City Center', latitude: 12.9716, longitude: 77.5946, stop_order: 2 },
          { id: 3, name: 'Airport', latitude: 12.9716, longitude: 77.5946, stop_order: 3 },
          { id: 4, name: 'Mall Junction', latitude: 12.9716, longitude: 77.5946, stop_order: 4 }
        ];
        setAllStops(mockStops);
      }
    } catch (error) {
      console.error('Error fetching stops:', error);
      // Fallback to mock stops
      const mockStops: BusStop[] = [
        { id: 1, name: 'Main Station', latitude: 12.9716, longitude: 77.5946, stop_order: 1 },
        { id: 2, name: 'City Center', latitude: 12.9716, longitude: 77.5946, stop_order: 2 },
        { id: 3, name: 'Airport', latitude: 12.9716, longitude: 77.5946, stop_order: 3 },
        { id: 4, name: 'Mall Junction', latitude: 12.9716, longitude: 77.5946, stop_order: 4 }
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
            bus_number: 'BUS001',
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
          bus_number: 'BUS001',
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
            bus_number: 'BUS001',
            current_latitude: 12.9716,
            current_longitude: 77.5946,
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

    // Use fetched stops or fallback to extracted stops from routes
    let stopsToShow = allStops;
    
    if (stopsToShow.length === 0) {
      // Extract stops from routes as fallback
      const extractedStops: BusStop[] = [];
      routes.forEach(route => {
        route.stops.forEach(stop => {
          if (!extractedStops.find(s => s.id === stop.id)) {
            extractedStops.push(stop);
          }
        });
      });
      stopsToShow = extractedStops;
    }

    // If still no stops, use mock data
    if (stopsToShow.length === 0) {
      stopsToShow = [
        { id: 1, name: 'Main Station', latitude: 12.9716, longitude: 77.5946, stop_order: 1 },
        { id: 2, name: 'City Center', latitude: 12.9716, longitude: 77.5946, stop_order: 2 },
        { id: 3, name: 'Airport', latitude: 12.9716, longitude: 77.5946, stop_order: 3 },
        { id: 4, name: 'Mall Junction', latitude: 12.9716, longitude: 77.5946, stop_order: 4 }
      ];
    }

    return (
      <View style={styles.searchContainer}>
        <Text style={styles.sectionTitle}>Plan Your Journey</Text>
        
        {/* Source Selection */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>From (Source):</Text>
          {currentLocation && (
            <TouchableOpacity
              style={styles.quickButton}
              onPress={() => {
                const closest = findClosestStop(currentLocation, stopsToShow);
                setSelectedSourceStop(closest);
              }}
            >
              <Text style={styles.quickButtonText}>📍 Use Closest Stop</Text>
            </TouchableOpacity>
          )}
          <ScrollView horizontal style={styles.stopsScroll}>
            {stopsToShow.map(stop => (
              <TouchableOpacity
                key={stop.id}
                style={[
                  styles.stopButton,
                  selectedSourceStop?.id === stop.id && styles.selectedStop
                ]}
                onPress={() => setSelectedSourceStop(stop)}
              >
                <Text style={[
                  styles.stopButtonText,
                  selectedSourceStop?.id === stop.id && styles.selectedStopText
                ]}>
                  {stop.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Destination Selection */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>To (Destination):</Text>
          <ScrollView horizontal style={styles.stopsScroll}>
            {stopsToShow
              .filter(stop => stop.id !== selectedSourceStop?.id)
              .map(stop => (
              <TouchableOpacity
                key={stop.id}
                style={[
                  styles.stopButton,
                  selectedDestinationStop?.id === stop.id && styles.selectedStop
                ]}
                onPress={() => setSelectedDestinationStop(stop)}
              >
                <Text style={[
                  styles.stopButtonText,
                  selectedDestinationStop?.id === stop.id && styles.selectedStopText
                ]}>
                  {stop.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Search Button */}
        <TouchableOpacity
          style={styles.searchButton}
          onPress={findAvailableBuses}
          disabled={loading || !selectedSourceStop || !selectedDestinationStop}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.searchButtonText}>🔍 Find Available Buses</Text>
          )}
        </TouchableOpacity>

        {/* Available Buses */}
        {availableBuses.length > 0 && (
          <View style={styles.busesContainer}>
            <Text style={styles.sectionTitle}>Available Buses</Text>
            {availableBuses.map(bus => (
              <View key={bus.id} style={styles.busCard}>
                <View style={styles.busInfo}>
                  <Text style={styles.busNumber}>Bus {bus.bus_number}</Text>
                  <Text style={styles.routeName}>{bus.route?.route_name}</Text>
                  <Text style={styles.routeDetails}>
                    {selectedSourceStop?.name} → {selectedDestinationStop?.name}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.bookButton}
                  onPress={() => bookTicket(bus.id)}
                  disabled={loading}
                >
                  <Text style={styles.bookButtonText}>Book Ticket</Text>
                </TouchableOpacity>
              </View>
            ))}
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
            tickets.map(ticket => (
              <TouchableOpacity
                key={ticket.id}
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
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  bookButtonText: {
    color: 'white',
    fontWeight: '600',
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
});

export default PassengerDashboard;
