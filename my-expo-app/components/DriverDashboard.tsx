import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet, Vibration } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import QRScanner from './QRScanner';
import RouteMap from './RouteMap';
import * as Location from 'expo-location';

// API Configuration - should match AuthContext
const API_BASE_URL = 'http://10.26.181.214:8000';

interface BusInfo {
  bus_id: number;
  bus_number: string;
  route: {
    id: number;
    route_name: string;
    origin: string;
    destination: string;
    stops: Array<{
      id: number;
      name: string;
      latitude: number;
      longitude: number;
      stop_order: number;
    }>;
  };
}

interface LocationData {
  latitude: number;
  longitude: number;
}

const DriverDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showRouteMap, setShowRouteMap] = useState(false);
  const [currentBusInfo, setCurrentBusInfo] = useState<BusInfo | null>(null);
  const [isTrackingGPS, setIsTrackingGPS] = useState(false);
  const [isTripActive, setIsTripActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [proximityAlert, setProximityAlert] = useState<any>(null);
  const [nextStop, setNextStop] = useState<any>(null);
  const [isEmergency, setIsEmergency] = useState(false);
  
  const locationSubscription = useRef<any>(null);
  const proximityCheckInterval = useRef<any>(null);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopGPSTracking();
    };
  }, []);

  const handleQRScan = async (data: any) => {
    try {
      console.log('Raw QR Data:', data);
      console.log('Data type:', typeof data);
      
      let busData;
      
      // Handle different data types from QR scanner
      if (typeof data === 'string') {
        try {
          busData = JSON.parse(data);
        } catch {
          // If JSON parsing fails, treat as bus ID
          busData = { bus_id: parseInt(data) };
        }
      } else if (typeof data === 'object' && data !== null) {
        // Direct object from QR scanner component
        busData = data;
      } else {
        throw new Error('Invalid QR data received');
      }
      
      console.log('Processed Bus Data:', busData);
      
      // Handle the complex response format from QR code
      let bus_id, bus_number, route_id;
      
      if (busData.bus && busData.bus.id) {
        // Complex response from backend (current format)
        bus_id = busData.bus.id;
        bus_number = busData.bus.bus_number;
        route_id = busData.current_route?.id;
        
        console.log('Extracted data:', { bus_id, bus_number, route_id });
        
        if (!route_id) {
          Alert.alert('No Route Assigned', 'This bus does not have an active route assigned.');
          setShowQRScanner(false);
          return;
        }
        
        // Use the existing route data from QR if available
        if (busData.current_route) {
          const routeInfo = busData.current_route;
          const completeInfo: BusInfo = {
            bus_id: bus_id,
            bus_number: bus_number,
            route: {
              id: routeInfo.id,
              route_name: routeInfo.route_name,
              origin: routeInfo.origin,
              destination: routeInfo.destination,
              stops: routeInfo.stops || []
            }
          };
          
          setCurrentBusInfo(completeInfo);
          setShowQRScanner(false);
          setShowRouteMap(true);
          
          Alert.alert(
            'Route Loaded Successfully',
            `Bus: ${completeInfo.bus_number}\nRoute: ${completeInfo.route.route_name}\nFrom: ${completeInfo.route.origin}\nTo: ${completeInfo.route.destination}`,
            [
              { text: 'Start Trip', onPress: startTrip }
            ]
          );
          return;
        }
      } else if (busData.bus_id) {
        // Simple JSON response (legacy format)
        bus_id = busData.bus_id;
        bus_number = busData.bus_number;
        route_id = busData.route_id;
      } else {
        throw new Error('Invalid QR code format - missing bus information');
      }
      
      // Fetch complete route information for map display if not included in QR
      await fetchRouteData(bus_id, bus_number, route_id);
      
    } catch (parseError) {
      console.error('QR Scan Error:', parseError);
      
      // If data processing fails, try treating it as a simple bus ID
      try {
        let busIdString = '';
        
        if (typeof data === 'string') {
          busIdString = data.trim();
        } else if (typeof data === 'object' && data !== null) {
          // If it's an object, it might already be processed bus info
          console.log('Received object data, checking for bus info...');
          if (data.bus_id || (data.bus && data.bus.id)) {
            // This looks like already processed bus data, just use it directly
            const bus_id = data.bus_id || data.bus.id;
            const bus_number = data.bus_number || (data.bus && data.bus.bus_number);
            const route_id = data.route_id || (data.current_route && data.current_route.id);
            
            if (route_id) {
              await fetchRouteData(bus_id, bus_number, route_id);
              return;
            }
          }
          throw new Error('Object data does not contain valid bus information');
        } else {
          throw new Error('Invalid data type received');
        }
        
        console.log('Trimmed data:', busIdString);
        
        const busId = parseInt(busIdString);
        if (isNaN(busId)) {
          throw new Error('QR code is neither valid JSON nor a bus ID');
        }
        
        console.log('Treating as bus ID:', busId);
        
        // Fetch bus info from backend using the QR info endpoint
        const response = await fetch(`${API_BASE_URL}/buses/${busId}/qr-info`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch bus information from server');
        }
        
        const qrData = await response.json();
        
        if (qrData.error) {
          Alert.alert('Bus Error', qrData.error);
          setShowQRScanner(false);
          return;
        }
        
        // Extract the needed data from the QR response format
        const bus_id = qrData.bus?.id;
        const bus_number = qrData.bus?.bus_number;
        const route_id = qrData.current_route?.id;
        
        if (!bus_id || !bus_number || !route_id) {
          Alert.alert('Invalid Data', 'Bus information is incomplete or route not assigned.');
          setShowQRScanner(false);
          return;
        }
        
        // Continue with the extracted data
        await fetchRouteData(bus_id, bus_number, route_id);
        
      } catch (fallbackError) {
        console.error('Fallback Error:', fallbackError);
        const errorMessage = fallbackError instanceof Error ? fallbackError.message : 'Invalid QR Code format';
        Alert.alert('QR Code Error', `Could not process QR code: ${errorMessage}`);
        setShowQRScanner(false);
      }
    }
  };

  const fetchRouteData = async (bus_id: number, bus_number: string, route_id: number) => {
    try {
      if (!route_id) {
        Alert.alert('No Route Assigned', 'This bus does not have an active route assigned.');
        setShowQRScanner(false);
        return;
      }
      
      // Fetch complete route information for map display
      const response = await fetch(`http://10.26.181.214:8000/buses/routes/${route_id}/map-data`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const routeData = await response.json();
        const completeInfo: BusInfo = {
          bus_id: bus_id,
          bus_number: bus_number,
          route: {
            id: routeData.route_id,
            route_name: routeData.route_name,
            origin: routeData.stops.find((s: any) => s.id === 'origin')?.name || 'Unknown',
            destination: routeData.stops.find((s: any) => s.id === 'destination')?.name || 'Unknown',
            stops: routeData.stops.filter((s: any) => s.id !== 'origin' && s.id !== 'destination')
          }
        };
        
        setCurrentBusInfo(completeInfo);
        setShowQRScanner(false);
        setShowRouteMap(true);
        
        Alert.alert(
          'Route Loaded Successfully',
          `Bus: ${completeInfo.bus_number}\nRoute: ${completeInfo.route.route_name}\nFrom: ${completeInfo.route.origin}\nTo: ${completeInfo.route.destination}`,
          [
            { text: 'Start Trip', onPress: startTrip }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to load route information from server');
        setShowQRScanner(false);
      }
    } catch (error) {
      console.error('Fetch Route Data Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process bus data';
      Alert.alert('Error', errorMessage);
      setShowQRScanner(false);
    }
  };

  const startTrip = async () => {
    if (!currentBusInfo) return;
    
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Location permission is needed to start GPS tracking');
      return;
    }

    setIsTripActive(true);
    setIsTrackingGPS(true);
    startGPSTracking();
    
    Alert.alert('Trip Started', 'GPS tracking is now active. You will receive proximity alerts when approaching bus stops.');
  };

  const startGPSTracking = async () => {
    try {
      // Start continuous location tracking
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 5, // Update every 5 meters
        },
        async (location) => {
          const locationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          };
          
          setCurrentLocation(locationData);
          
          // Send location to backend
          await sendLocationUpdate(locationData);
        }
      );
      
      locationSubscription.current = subscription;
      
      // Start proximity checking
      proximityCheckInterval.current = setInterval(checkProximity, 3000); // Check every 3 seconds
      
    } catch (error) {
      console.error('GPS Tracking Error:', error);
      Alert.alert('Error', 'Failed to start GPS tracking');
    }
  };

  const sendLocationUpdate = async (location: LocationData) => {
    if (!currentBusInfo || !token) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/buses/driver/update-location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          bus_id: currentBusInfo.bus_id
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Handle proximity alerts from backend
        if (result.proximity_alert) {
          handleProximityAlert(result.proximity_alert);
        }
        
        if (result.next_stop) {
          setNextStop(result.next_stop);
        }
      }
    } catch (error) {
      console.error('Location update error:', error);
    }
  };

  const checkProximity = async () => {
    if (!currentLocation || !token) return;
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/buses/driver/proximity-check?latitude=${currentLocation.latitude}&longitude=${currentLocation.longitude}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        if (result.proximity_alert) {
          handleProximityAlert(result.proximity_alert);
        }
      }
    } catch (error) {
      console.error('Proximity check error:', error);
    }
  };

  const handleProximityAlert = async (alert: any) => {
    setProximityAlert(alert);
    
    // Vibrate phone
    Vibration.vibrate([500, 200, 500, 200, 500]);
    
    // Show alert
    Alert.alert(
      '🚏 Bus Stop Alert',
      `Approaching ${alert.stop_name}\nDistance: ${alert.distance_meters}m`,
      [{ text: 'OK', onPress: () => setProximityAlert(null) }]
    );
  };

  const stopGPSTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    
    if (proximityCheckInterval.current) {
      clearInterval(proximityCheckInterval.current);
      proximityCheckInterval.current = null;
    }
    
    setIsTrackingGPS(false);
  };

  const endTrip = async () => {
    Alert.alert(
      'End Trip',
      'Are you sure you want to end this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Trip',
          style: 'destructive',
          onPress: () => {
            stopGPSTracking();
            setIsTripActive(false);
            setCurrentBusInfo(null);
            setShowRouteMap(false);
            setProximityAlert(null);
            setNextStop(null);
            Alert.alert('Trip Ended', 'Thank you for your service!');
          }
        }
      ]
    );
  };

  const sendSOSAlert = async () => {
    if (!currentLocation || !currentBusInfo) {
      Alert.alert('Error', 'Location not available for SOS');
      return;
    }
    
    Alert.alert(
      '🚨 Emergency Alert',
      'What type of emergency is this?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Breakdown', 
          onPress: () => sendEmergencyAlert('breakdown')
        },
        { 
          text: 'Accident', 
          onPress: () => sendEmergencyAlert('accident')
        },
        { 
          text: 'Medical Emergency', 
          onPress: () => sendEmergencyAlert('medical')
        },
        { 
          text: 'Other', 
          onPress: () => sendEmergencyAlert('other')
        }
      ]
    );
  };

  const sendEmergencyAlert = async (emergencyType: string) => {
    if (!currentLocation || !currentBusInfo || !token) return;
    
    setIsEmergency(true);
    
    try {
      const response = await fetch('http://10.26.181.214:8000/buses/emergency-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          bus_id: currentBusInfo.bus_id,
          driver_id: user?.id,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          emergency_type: emergencyType,
          message: `Emergency: ${emergencyType} reported by driver`,
          timestamp: new Date().toISOString()
        }),
      });
      
      if (response.ok) {
        Alert.alert(
          '✅ SOS Sent',
          'Emergency alert has been sent to admin. Help is on the way!',
          [{ text: 'OK', onPress: () => setIsEmergency(false) }]
        );
      } else {
        throw new Error('Failed to send SOS');
      }
    } catch (error) {
      console.error('SOS Error:', error);
      Alert.alert('Error', 'Failed to send emergency alert. Please try again.');
      setIsEmergency(false);
    }
  };

  if (showQRScanner) {
    return (
      <QRScanner 
        onScanSuccess={(data) => handleQRScan(data)}
        onCancel={() => setShowQRScanner(false)}
      />
    );
  }

  if (showRouteMap && currentBusInfo) {
    return (
      <View style={styles.container}>
        <RouteMap 
          busInfo={currentBusInfo}
          onClose={() => setShowRouteMap(false)}
        />
        
        {/* Trip Control Overlay */}
        <View style={styles.overlay}>
          <View style={styles.tripInfo}>
            <Text style={styles.routeName}>{currentBusInfo.route.route_name}</Text>
            <Text style={styles.routeDetails}>
              {currentBusInfo.route.origin} → {currentBusInfo.route.destination}
            </Text>
            {nextStop && (
              <Text style={styles.nextStop}>
                Next Stop: {nextStop.stop_name} ({nextStop.distance_meters}m)
              </Text>
            )}
          </View>
          
          <View style={styles.controlButtons}>
            {!isTripActive ? (
              <TouchableOpacity style={styles.startButton} onPress={startTrip}>
                <Text style={styles.buttonText}>🚍 Start Trip</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={styles.endButton} onPress={endTrip}>
                  <Text style={styles.buttonText}>🏁 End Trip</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.sosButton, isEmergency && styles.sosButtonActive]} 
                  onPress={sendSOSAlert}
                  disabled={isEmergency}
                >
                  <Text style={styles.buttonText}>
                    {isEmergency ? '📡 Sending...' : '🚨 SOS'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          
          {/* GPS Status */}
          <View style={styles.statusBar}>
            <Text style={styles.statusText}>
              GPS: {isTrackingGPS ? '🟢 Active' : '🔴 Inactive'}
            </Text>
            {currentLocation && (
              <Text style={styles.statusText}>
                Location: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              </Text>
            )}
          </View>
        </View>
        
        {/* Proximity Alert Overlay */}
        {proximityAlert && (
          <View style={styles.alertOverlay}>
            <View style={styles.alertBox}>
              <Text style={styles.alertTitle}>🚏 Bus Stop Approaching!</Text>
              <Text style={styles.alertText}>{proximityAlert.stop_name}</Text>
              <Text style={styles.alertDistance}>{proximityAlert.distance_meters}m away</Text>
              <TouchableOpacity 
                style={styles.alertButton}
                onPress={() => setProximityAlert(null)}
              >
                <Text style={styles.buttonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  // Main Dashboard View
  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🚍 Driver Dashboard</Text>
        <Text style={styles.welcome}>Welcome, {user?.full_name || user?.email}!</Text>
      </View>
      
      {/* Current Trip Status */}
      {currentBusInfo && currentBusInfo.bus_number && (
        <View style={styles.currentTripCard}>
          <Text style={styles.cardTitle}>Current Assignment</Text>
          <Text style={styles.busNumber}>Bus: {currentBusInfo.bus_number}</Text>
          <Text style={styles.routeInfo}>{currentBusInfo.route.route_name}</Text>
          <Text style={styles.routeDetails}>
            {currentBusInfo.route.origin} → {currentBusInfo.route.destination}
          </Text>
          
          {isTripActive && (
            <View style={styles.statusIndicator}>
              <Text style={styles.statusActive}>🟢 Trip Active</Text>
              {isTrackingGPS && <Text style={styles.statusGPS}>📍 GPS Tracking</Text>}
            </View>
          )}
        </View>
      )}
      
      {/* Action Buttons */}
      <View style={styles.actionSection}>
        {!currentBusInfo ? (
          <TouchableOpacity style={styles.primaryButton} onPress={() => setShowQRScanner(true)}>
            <Text style={styles.buttonText}>📱 Scan Bus QR Code</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.buttonGroup}>
            <TouchableOpacity style={styles.mapButton} onPress={() => setShowRouteMap(true)}>
              <Text style={styles.buttonText}>🗺️ View Route Map</Text>
            </TouchableOpacity>
            
            {!isTripActive ? (
              <TouchableOpacity style={styles.startButton} onPress={startTrip}>
                <Text style={styles.buttonText}>🚍 Start Trip</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.endButton} onPress={endTrip}>
                <Text style={styles.buttonText}>🏁 End Trip</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Emergency SOS Button - Always Available */}
        <TouchableOpacity 
          style={[styles.sosButton, isEmergency && styles.sosButtonActive]} 
          onPress={sendSOSAlert}
          disabled={isEmergency}
        >
          <Text style={styles.sosButtonText}>
            {isEmergency ? '📡 Sending Emergency Alert...' : '🚨 Emergency SOS'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Trip Information */}
      {isTripActive && currentLocation && (
        <View style={styles.tripInfoCard}>
          <Text style={styles.cardTitle}>Trip Information</Text>
          <Text style={styles.infoText}>📍 Current Location:</Text>
          <Text style={styles.coordinates}>
            {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
          </Text>
          
          {nextStop && (
            <View style={styles.nextStopInfo}>
              <Text style={styles.infoText}>🚏 Next Stop:</Text>
              <Text style={styles.nextStopName}>{nextStop.stop_name}</Text>
              <Text style={styles.distance}>Distance: {nextStop.distance_meters}m</Text>
            </View>
          )}
          
          <View style={styles.statusRow}>
            <Text style={isTrackingGPS ? styles.statusActive : styles.statusInactive}>
              GPS: {isTrackingGPS ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      )}
      
      {/* Instructions */}
      <View style={styles.instructionsCard}>
        <Text style={styles.cardTitle}>📋 Instructions</Text>
        <Text style={styles.instructionText}>1. Scan the QR code on your assigned bus</Text>
        <Text style={styles.instructionText}>2. Review the route and start your trip</Text>
        <Text style={styles.instructionText}>3. GPS tracking will alert you near bus stops</Text>
        <Text style={styles.instructionText}>4. Use SOS button for emergencies</Text>
        <Text style={styles.instructionText}>5. End trip when you reach destination</Text>
      </View>
      
      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.buttonText}>🚪 Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  welcome: {
    fontSize: 18,
    color: '#7f8c8d',
  },
  currentTripCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  busNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 5,
  },
  routeInfo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3498db',
    marginBottom: 5,
  },
  routeDetails: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 10,
  },
  statusIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  statusActive: {
    color: '#27ae60',
    fontWeight: 'bold',
  },
  statusGPS: {
    color: '#3498db',
    fontWeight: 'bold',
  },
  actionSection: {
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonGroup: {
    gap: 10,
    marginBottom: 15,
  },
  mapButton: {
    backgroundColor: '#2ecc71',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#27ae60',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  endButton: {
    backgroundColor: '#e67e22',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  sosButton: {
    backgroundColor: '#e74c3c',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#c0392b',
  },
  sosButtonActive: {
    backgroundColor: '#c0392b',
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sosButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tripInfoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 5,
  },
  coordinates: {
    fontSize: 12,
    color: '#7f8c8d',
    fontFamily: 'monospace',
    marginBottom: 15,
  },
  nextStopInfo: {
    backgroundColor: '#ecf0f1',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  nextStopName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  distance: {
    fontSize: 14,
    color: '#e67e22',
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  statusInactive: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  instructionsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionText: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 8,
    paddingLeft: 10,
  },
  logoutButton: {
    backgroundColor: '#95a5a6',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  
  // Map Overlay Styles
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
    padding: 20,
  },
  tripInfo: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginTop: 50,
  },
  routeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  nextStop: {
    fontSize: 14,
    color: '#e67e22',
    fontWeight: '600',
    marginTop: 5,
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statusBar: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  
  // Alert Overlay Styles
  alertOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBox: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 300,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 10,
  },
  alertText: {
    fontSize: 18,
    color: '#2c3e50',
    marginBottom: 5,
  },
  alertDistance: {
    fontSize: 16,
    color: '#e67e22',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  alertButton: {
    backgroundColor: '#3498db',
    padding: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
});

export default DriverDashboard;


