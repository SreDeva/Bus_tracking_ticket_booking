import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface WebMapProps {
  stops: any[];
  routeGeometry?: any; // Add geometry prop
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}

const WebMap: React.FC<WebMapProps> = ({ stops, routeGeometry, currentLocation, region }) => {
  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Route Map</title>
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
            }
        </style>
    </head>
    <body>
        <div class="loading">Loading map...</div>
        <div id="map"></div>
        <script>
            try {
                // Hide loading message
                document.querySelector('.loading').style.display = 'none';
                
                // Initialize map
                const map = L.map('map').setView([${region.latitude}, ${region.longitude}], 13);
            
            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);
            
            // Add stops as markers
            const stops = ${JSON.stringify(stops)};
            const routeGeometry = ${JSON.stringify(routeGeometry)};
            
            stops.forEach((stop, index) => {
                if (stop.latitude && stop.longitude) {
                    const marker = L.marker([stop.latitude, stop.longitude])
                        .addTo(map)
                        .bindPopup(\`<b>\${stop.name}</b><br>Stop #\${stop.stop_order || (index + 1)}\`);
                }
            });
            
            // Add current location if available
            ${currentLocation ? `
            L.marker([${currentLocation.latitude}, ${currentLocation.longitude}], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).addTo(map).bindPopup('Your Location');
            ` : ''}
            
            // Draw route line
            console.log('Route geometry check:', routeGeometry);
            if (routeGeometry && routeGeometry.features && routeGeometry.features.length > 0) {
                // Use the actual route geometry from backend
                console.log('Using route geometry from backend');
                const feature = routeGeometry.features[0];
                console.log('Feature:', feature);
                if (feature.geometry && feature.geometry.coordinates) {
                    console.log('Coordinates length:', feature.geometry.coordinates.length);
                    const coordinates = feature.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                    L.polyline(coordinates, {
                        color: 'blue', 
                        weight: 4, 
                        opacity: 0.8
                    }).addTo(map);
                    console.log('Added polyline with', coordinates.length, 'points');
                } else {
                    console.log('No coordinates in feature geometry');
                }
            } else if (stops.length > 1) {
                // Fallback to getting route from API
                console.log('No geometry from backend, calculating route...');
                const routeCoords = stops.map(stop => [stop.latitude, stop.longitude]);
                const fallbackLine = L.polyline(routeCoords, {color: 'lightblue', weight: 2, opacity: 0.5}).addTo(map);
                
                // Function to get route between two points
                const getRouteBetweenPoints = async (start, end) => {
                    const routeUrl = \`https://api.openrouteservice.org/v2/directions/driving-car?api_key=5b3ce3597851110001cf6248ac18e7f9d65a4a9aba734dc98b19c4bc&start=\${start.longitude},\${start.latitude}&end=\${end.longitude},\${end.latitude}\`;
                    
                    try {
                        const response = await fetch(routeUrl);
                        const data = await response.json();
                        
                        if (data.features && data.features[0] && data.features[0].geometry) {
                            return data.features[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
                        }
                    } catch (error) {
                        console.log('Route segment failed:', error);
                    }
                    return null;
                };
                
                // Get routes between consecutive stops
                const getFullRoute = async () => {
                    let allRouteCoords = [];
                    let hasRealRoute = false;
                    
                    for (let i = 0; i < stops.length - 1; i++) {
                        const segmentCoords = await getRouteBetweenPoints(stops[i], stops[i + 1]);
                        if (segmentCoords) {
                            allRouteCoords = allRouteCoords.concat(segmentCoords);
                            hasRealRoute = true;
                        } else {
                            // Fallback to straight line for this segment
                            allRouteCoords.push([stops[i].latitude, stops[i].longitude]);
                            allRouteCoords.push([stops[i + 1].latitude, stops[i + 1].longitude]);
                        }
                    }
                    
                    if (hasRealRoute && allRouteCoords.length > 0) {
                        // Remove fallback line
                        map.removeLayer(fallbackLine);
                        
                        // Add the actual route
                        L.polyline(allRouteCoords, {color: 'blue', weight: 4, opacity: 0.8}).addTo(map);
                    }
                };
                
                // Execute route calculation
                getFullRoute().catch(error => {
                    console.log('Full route calculation failed, using fallback:', error);
                });
            }
            
            // Fit map to show all markers
            if (stops.length > 0) {
                const group = new L.featureGroup();
                stops.forEach(stop => {
                    if (stop.latitude && stop.longitude) {
                        group.addLayer(L.marker([stop.latitude, stop.longitude]));
                    }
                });
                if (group.getLayers().length > 0) {
                    map.fitBounds(group.getBounds().pad(0.1));
                }
            }
            } catch (error) {
                console.error('Map initialization error:', error);
                document.querySelector('.loading').innerHTML = 'Map failed to load';
                document.querySelector('.loading').style.display = 'block';
            }
        </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        source={{ html: mapHTML }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});

export default WebMap;
