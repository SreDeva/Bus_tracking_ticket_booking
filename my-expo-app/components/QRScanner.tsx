import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, TextInput, ScrollView, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';

// API Configuration - should match AuthContext
// For consistency with AuthContext, we'll use the same IP configuration
const API_CONFIGS = {
  ANDROID_EMULATOR: 'http://10.26.181.214:8000',
  IOS_SIMULATOR: 'http://localhost:8000', 
  PHYSICAL_DEVICE: 'http://10.26.181.214:8000', // Replace with your IP
};

// Set the active configuration here - should match AuthContext
const API_BASE_URL = API_CONFIGS.PHYSICAL_DEVICE;

interface QRScannerProps {
  onScanSuccess: (busInfo: any) => void;
  onCancel: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, onCancel }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [showCamera, setShowCamera] = useState(true);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    setLoading(true);

    try {
      let busId: number;
      
      try {
        const qrData = JSON.parse(data);
        busId = qrData.bus_id;
      } catch {
        busId = parseInt(data);
      }

      if (!busId || isNaN(busId)) {
        throw new Error('Invalid QR code data');
      }

      const response = await fetch(`${API_BASE_URL}/buses/${busId}/qr-info`);
      if (!response.ok) {
        throw new Error('Failed to fetch bus information');
      }

      const busInfo = await response.json();

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        Alert.alert(
          'QR Scan Successful',
          `Bus: ${busInfo?.bus?.bus_number || 'Unknown'}\nRoute: ${busInfo?.current_route?.route_name || 'No active route'}\nGPS tracking will start.`,
          [
            {
              text: 'OK',
              onPress: () => {
                onScanSuccess(busInfo);
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Location Permission Required',
          'GPS tracking requires location permission.',
          [
            { text: 'Cancel', onPress: () => setScanned(false) },
            { text: 'OK', onPress: () => onScanSuccess(busInfo) }
          ]
        );
      }
    } catch (error) {
      console.error('Error processing QR scan:', error);
      Alert.alert(
        'Scan Error',
        error instanceof Error ? error.message : 'Failed to process QR code',
        [
          { text: 'Try Again', onPress: () => setScanned(false) },
          { text: 'Cancel', onPress: onCancel }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleManualScan = async () => {
    if (!manualInput.trim()) {
      Alert.alert('Error', 'Please enter a bus ID');
      return;
    }

    setLoading(true);

    try {
      let busId: number;
      
      try {
        const qrData = JSON.parse(manualInput);
        busId = qrData.bus_id;
      } catch {
        busId = parseInt(manualInput);
      }

      if (!busId || isNaN(busId)) {
        throw new Error('Invalid bus ID');
      }

      const response = await fetch(`${API_BASE_URL}/buses/${busId}/qr-info`);
      if (!response.ok) {
        throw new Error(`Failed to fetch bus information (Status: ${response.status})`);
      }

      const busInfo = await response.json();

      Alert.alert(
        'Bus Found Successfully! 🚌',
        `Bus: ${busInfo?.bus?.bus_number || 'Unknown'}\nRoute: ${busInfo?.current_route?.route_name || 'No active route'}\nGPS tracking will start automatically.`,
        [
          {
            text: 'Start Tracking',
            onPress: () => {
              onScanSuccess(busInfo);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error processing manual scan:', error);
      Alert.alert(
        'Scan Error',
        error instanceof Error ? error.message : 'Failed to process bus ID',
        [
          { text: 'Try Again' },
          { text: 'Cancel', onPress: onCancel }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const quickScanBus = (busId: number) => {
    setManualInput(busId.toString());
    setTimeout(() => {
      handleManualScan();
    }, 500);
  };

  // Show manual input interface for web/desktop or when camera fails
  if (showManualInput || Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Enter Bus Details</Text>
            <TouchableOpacity 
              onPress={() => setShowManualInput(false)} 
              style={styles.closeButton}>
              <Text style={styles.closeIcon}>📷</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.manualInputContainer}>
          <View style={styles.manualInputBox}>
            <Text style={styles.manualInputTitle}>Bus QR Scanner</Text>
            <Text style={styles.manualInputSubtitle}>
              Enter Bus ID or scan QR code data
            </Text>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Bus ID or QR Data:</Text>
              <TextInput
                style={styles.textInput}
                value={manualInput}
                onChangeText={setManualInput}
                placeholder="Enter bus ID (e.g., 1, 2, 3...)"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              onPress={handleManualScan}
              style={[styles.scanButton, loading && styles.scanButtonDisabled]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.scanButtonText}>Find Bus</Text>
              )}
            </TouchableOpacity>

            <View style={styles.quickAccessSection}>
              <Text style={styles.quickAccessTitle}>Quick Access (Test Buses):</Text>
              <View style={styles.quickButtonsContainer}>
                {[1, 2, 3, 4].map((busId) => (
                  <TouchableOpacity
                    key={busId}
                    onPress={() => quickScanBus(busId)}
                    style={styles.quickButton}
                    disabled={loading}
                  >
                    <Text style={styles.quickButtonText}>Bus {busId}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="white" />
        <Text style={styles.whiteText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.cameraIcon}>📷</Text>
        <Text style={styles.whiteTextCenter}>
          Camera access is required for QR code scanning
        </Text>
        <TouchableOpacity 
          onPress={async () => {
            const result = await requestPermission();
            if (!result.granted) {
              setShowManualInput(true);
            }
          }} 
          style={styles.backButton}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setShowManualInput(true)} 
          style={[styles.backButton, { marginTop: 12, backgroundColor: '#10B981' }]}>
          <Text style={styles.buttonText}>Enter Manually</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={[styles.backButton, { marginTop: 12, backgroundColor: '#6B7280' }]}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Scan Bus QR Code</Text>
            <TouchableOpacity 
              onPress={() => setShowManualInput(true)} 
              style={styles.closeButton}>
              <Text style={styles.closeIcon}>⌨️</Text>
            </TouchableOpacity>
          </View>
        </View>      {/* Scanner */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Scanning Frame */}
      <View style={styles.scanFrame}>
        <View style={styles.scanBorder}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <View style={styles.instructionBox}>
          <Text style={styles.instructionTitle}>Position QR Code in Frame</Text>
          <Text style={styles.instructionText}>Hold steady and wait for automatic scanning</Text>
        </View>
      </View>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Processing QR Code...</Text>
          </View>
        </View>
      )}

      {/* Try Again Button */}
      {scanned && !loading && (
        <View style={styles.tryAgainContainer}>
          <TouchableOpacity onPress={() => setScanned(false)} style={styles.tryAgainButton}>
            <Text style={styles.buttonText}>Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  whiteText: {
    color: 'white',
    fontSize: 18,
    marginTop: 16,
  },
  whiteTextCenter: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
  },
  cameraIcon: {
    fontSize: 64,
  },
  backButton: {
    marginTop: 24,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
  header: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 12,
    borderRadius: 24,
  },
  closeIcon: {
    color: 'white',
    fontSize: 24,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  spacer: {
    width: 48,
  },
  scanFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBorder: {
    width: 256,
    height: 256,
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 8,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#3B82F6',
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  instructions: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
  },
  instructionBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16,
    borderRadius: 8,
  },
  instructionTitle: {
    color: 'white',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  instructionText: {
    color: '#D1D5DB',
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  loadingText: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  tryAgainContainer: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
  },
  tryAgainButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
  },
  // Manual input styles
  manualInputContainer: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 100,
  },
  manualInputBox: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  manualInputTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  manualInputSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
  },
  scanButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 32,
  },
  scanButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  scanButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  quickAccessSection: {
    alignItems: 'center',
  },
  quickAccessTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 16,
  },
  quickButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  quickButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
  },
  quickButtonText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default QRScanner;
