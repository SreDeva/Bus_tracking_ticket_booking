import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';

interface FaceCaptureProps {
  onCapture: (imageUri: string, base64: string) => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
}

export default function FaceCapture({ 
  onCapture, 
  onCancel, 
  title = "Face Recognition Setup",
  subtitle = "Position your face in the center and take a clear photo"
}: FaceCaptureProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const takePicture = async () => {
    if (cameraRef.current && !isCapturing) {
      setIsCapturing(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: true,
          skipProcessing: false,
        });
        
        if (photo) {
          setCapturedImage(photo.uri);
          
          // Call the onCapture callback with both URI and base64
          if (photo.base64) {
            onCapture(photo.uri, photo.base64);
          }
        }
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture. Please try again.');
      } finally {
        setIsCapturing(false);
      }
    }
  };

  const retakePicture = () => {
    setCapturedImage(null);
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  };

  if (!permission) {
    return (
      <View className="flex-1 justify-center items-center bg-black">
        <Text className="text-white text-lg">Requesting camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 justify-center items-center bg-black p-4">
        <MaterialIcons name="camera-alt" size={64} color="white" />
        <Text className="text-white text-lg text-center mt-4">
          Camera access is required for face recognition
        </Text>
        <TouchableOpacity
          className="bg-blue-600 px-6 py-3 rounded-lg mt-4"
          onPress={requestPermission}
        >
          <Text className="text-white font-semibold">Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-gray-600 px-6 py-3 rounded-lg mt-2"
          onPress={onCancel}
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (capturedImage) {
    return (
      <View className="flex-1 bg-black">
        {/* Header */}
        <View className="absolute top-0 left-0 right-0 z-10 bg-black/50 pt-12 pb-4 px-4">
          <Text className="text-white text-xl font-bold text-center">{title}</Text>
          <Text className="text-white/80 text-sm text-center mt-1">Review your photo</Text>
        </View>

        {/* Captured Image */}
        <Image source={{ uri: capturedImage }} className="flex-1" resizeMode="cover" />

        {/* Bottom Controls */}
        <View className="absolute bottom-0 left-0 right-0 bg-black/50 p-6">
          <View className="flex-row justify-around items-center">
            <TouchableOpacity
              className="bg-gray-600 px-6 py-3 rounded-lg"
              onPress={retakePicture}
            >
              <Text className="text-white font-semibold">Retake</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="bg-green-600 px-8 py-3 rounded-lg"
              onPress={() => {
                Alert.alert('Success', 'Photo captured successfully!');
              }}
            >
              <Text className="text-white font-semibold">Use Photo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Header */}
      <View className="absolute top-0 left-0 right-0 z-10 bg-black/50 pt-12 pb-4 px-4">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={onCancel}>
            <MaterialIcons name="close" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1 mx-4">
            <Text className="text-white text-lg font-bold text-center">{title}</Text>
            <Text className="text-white/80 text-xs text-center mt-1">{subtitle}</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>
      </View>

      {/* Camera */}
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing={facing}
        flash={flash}
      >
        {/* Face Guide Overlay */}
        <View className="flex-1 justify-center items-center">
          <View className="w-64 h-80 border-2 border-white rounded-full border-dashed opacity-50" />
          <Text className="text-white text-center mt-4 px-4">
            Position your face within the circle
          </Text>
        </View>

        {/* Camera Controls */}
        <View className="absolute top-20 right-4 space-y-4">
          <TouchableOpacity
            className="bg-black/50 p-3 rounded-full"
            onPress={toggleCameraFacing}
          >
            <MaterialIcons name="flip-camera-ios" size={24} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity
            className="bg-black/50 p-3 rounded-full"
            onPress={toggleFlash}
          >
            <MaterialIcons 
              name={flash === 'on' ? "flash-on" : "flash-off"} 
              size={24} 
              color="white" 
            />
          </TouchableOpacity>
        </View>

        {/* Bottom Controls */}
        <View className="absolute bottom-0 left-0 right-0 bg-black/50 p-6">
          <View className="flex-row justify-center items-center">
            <TouchableOpacity
              className="bg-white/20 w-20 h-20 rounded-full justify-center items-center border-4 border-white"
              onPress={takePicture}
              disabled={isCapturing}
            >
              {isCapturing ? (
                <View className="w-6 h-6 bg-red-500 rounded-full" />
              ) : (
                <View className="w-12 h-12 bg-white rounded-full" />
              )}
            </TouchableOpacity>
          </View>
          
          <Text className="text-white/80 text-xs text-center mt-3">
            Tap the circle to capture your face
          </Text>
        </View>
      </CameraView>
    </View>
  );
}
