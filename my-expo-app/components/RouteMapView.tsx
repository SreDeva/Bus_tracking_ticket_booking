import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Alert } from 'react-native';
import { WebView } from 'react-native-webview';

interface BusLocation {
  bus_id: number;
  bus_number: string;
  latitude: number;
  longitude: number;
  distance_from_user_km?: number;
  estimated_arrival_minutes?: number;
  route_name: string;
  next_stop?: string;
}

interface BusStop {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  distance_km?: number;
}

interface RouteMapViewProps {
  sourceStop: BusStop;
  destinationStop: BusStop;
  buses: BusLocation[];
  userLocation?: { latitude: number; longitude: number };
  onBusSelect: (bus: BusLocation) => void;
  recommendedBus?: BusLocation;
}

const RouteMapView: React.FC<RouteMapViewProps> = ({
  sourceStop,
  destinationStop,
  buses,
  userLocation,
  onBusSelect,
  recommendedBus
}) => {
  const [webViewRef, setWebViewRef] = useState<any>(null);

  const generateMapHTML = () => {
    const mapCenter = {
      lat: (sourceStop.latitude + destinationStop.latitude) / 2,
      lng: (sourceStop.longitude + destinationStop.longitude) / 2
    };

    const busMarkers = buses.map(bus => ({
      ...bus,
      isRecommended: recommendedBus?.bus_id === bus.bus_id
    }));

    const userLocationScript = userLocation ? `
            const userMarker = L.marker([${userLocation.latitude}, ${userLocation.longitude}], {icon: userIcon})
                .addTo(map)
                .bindPopup('<div class="stop-popup"><div class="stop-header">👤 Your Location</div></div>');
    ` : '';

    const sourceDistanceText = sourceStop.distance_km ? 
      `<div>Distance: ${sourceStop.distance_km.toFixed(2)} km</div>` : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
        <style>
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
            #map { height: 100vh; width: 100%; }
            .bus-popup {
                text-align: center;
                min-width: 200px;
            }
            .bus-header {
                font-weight: bold;
                font-size: 16px;
                margin-bottom: 8px;
                color: #1f2937;
            }
            .bus-info {
                margin-bottom: 6px;
                color: #374151;
            }
            .bus-select-btn {
                background: #3b82f6;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                margin-top: 8px;
                font-weight: bold;
            }
            .bus-select-btn:hover {
                background: #2563eb;
            }
            .recommended-badge {
                background: #10b981;
                color: white;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 12px;
                margin-bottom: 8px;
                display: inline-block;
            }
            .stop-popup {
                text-align: center;
                min-width: 150px;
            }
            .stop-header {
                font-weight: bold;
                font-size: 14px;
                color: #1f2937;
            }
        </style>
    </head>
    <body>
        <div id="map"></div>
        <script>
            // Initialize map
            const map = L.map('map').setView([${mapCenter.lat}, ${mapCenter.lng}], 13);
            
            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);

            // Custom icons
            const busIcon = L.divIcon({
                html: '<div style="background: #3b82f6; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><span style="color: white; font-size: 12px; font-weight: bold;">🚌</span></div>',
                iconSize: [30, 30],
                iconAnchor: [15, 15],
                className: 'bus-marker'
            });

            const recommendedBusIcon = L.divIcon({
                html: '<div style="background: #10b981; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.5); display: flex; align-items: center; justify-content: center; animation: pulse 2s infinite;"><span style="color: white; font-size: 14px; font-weight: bold;">🚌</span></div>',
                iconSize: [34, 34],
                iconAnchor: [17, 17],
                className: 'recommended-bus-marker'
            });

            const sourceIcon = L.divIcon({
                html: '<div style="background: #22c55e; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const destinationIcon = L.divIcon({
                html: '<div style="background: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const userIcon = L.divIcon({
                html: '<div style="background: #8b5cf6; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });

            // Add source stop
            const sourceMarker = L.marker([${sourceStop.latitude}, ${sourceStop.longitude}], {icon: sourceIcon})
                .addTo(map)
                .bindPopup(\`
                    <div class="stop-popup">
                        <div class="stop-header">📍 Source</div>
                        <div><strong>${sourceStop.name}</strong></div>
                        ${sourceDistanceText}
                    </div>
                \`);

            // Add destination stop
            const destMarker = L.marker([${destinationStop.latitude}, ${destinationStop.longitude}], {icon: destinationIcon})
                .addTo(map)
                .bindPopup(\`
                    <div class="stop-popup">
                        <div class="stop-header">🎯 Destination</div>
                        <div><strong>${destinationStop.name}</strong></div>
                    </div>
                \`);

            // Add user location if available
            ${userLocationScript}

            // Add route line
            const routeLine = L.polyline([
                [${sourceStop.latitude}, ${sourceStop.longitude}],
                [${destinationStop.latitude}, ${destinationStop.longitude}]
            ], {
                color: '#3b82f6',
                weight: 4,
                opacity: 0.7,
                dashArray: '10, 10'
            }).addTo(map);

            // Add buses
            const buses = ${JSON.stringify(busMarkers)};
            buses.forEach(bus => {
                const icon = bus.isRecommended ? recommendedBusIcon : busIcon;
                const marker = L.marker([bus.latitude, bus.longitude], {icon: icon})
                    .addTo(map)
                    .bindPopup(\`
                        <div class="bus-popup">
                            \${bus.isRecommended ? '<div class="recommended-badge">⭐ Recommended</div>' : ''}
                            <div class="bus-header">\${bus.bus_number}</div>
                            <div class="bus-info">Route: \${bus.route_name}</div>
                            \${bus.distance_from_user_km ? \`<div class="bus-info">Distance: \${bus.distance_from_user_km.toFixed(2)} km</div>\` : ''}
                            \${bus.estimated_arrival_minutes ? \`<div class="bus-info">ETA: \${bus.estimated_arrival_minutes} min</div>\` : ''}
                            \${bus.next_stop ? \`<div class="bus-info">Next: \${bus.next_stop}</div>\` : ''}
                            <button class="bus-select-btn" onclick="selectBus(\${bus.bus_id})">
                                Select This Bus
                            </button>
                        </div>
                    \`);
            });

            // Fit map to show all markers
            const group = new L.featureGroup([sourceMarker, destMarker, ...buses.map(bus => 
                L.marker([bus.latitude, bus.longitude])
            )]);
            map.fitBounds(group.getBounds().pad(0.1));

            // Bus selection function
            function selectBus(busId) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'busSelected',
                    busId: busId
                }));
            }

            // Add pulse animation
            const style = document.createElement('style');
            style.textContent = \`
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
            \`;
            document.head.appendChild(style);
        </script>
    </body>
    </html>
    `;
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'busSelected') {
        const selectedBus = buses.find(bus => bus.bus_id === data.busId);
        if (selectedBus) {
          onBusSelect(selectedBus);
        }
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={setWebViewRef}
        source={{ html: generateMapHTML() }}
        style={styles.webview}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />
      
      {/* Map Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
          <Text style={styles.legendText}>Source</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.legendText}>Destination</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
          <Text style={styles.legendText}>Bus</Text>
        </View>
        {recommendedBus && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.legendText}>Recommended</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  legend: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 120,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'white',
  },
  legendText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
});

export default RouteMapView;
