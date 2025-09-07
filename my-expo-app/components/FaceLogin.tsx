import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import FaceCapture from './FaceCapture';

interface FaceLoginProps {
  onBack: () => void;
}

const FaceLogin: React.FC<FaceLoginProps> = ({ onBack }) => {
  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(false);
  const { loginWithFace } = useAuth();

  const handleFaceLogin = () => {
    setShowCamera(true);
  };

  const handleFaceCapture = async (imageUri: string, base64: string) => {
    try {
      setLoading(true);
      setShowCamera(false);
      
      const result = await loginWithFace(base64);
      
      if (!result.success) {
        Alert.alert(
          'Face Recognition Failed', 
          result.error || 'Face not recognized. Please try again or use password login.',
          [
            { text: 'Try Again', onPress: () => setShowCamera(true) },
            { text: 'Use Password', onPress: onBack }
          ]
        );
      }
      // Success is handled by the auth context
    } catch (error) {
      console.error('Face login error:', error);
      Alert.alert(
        'Login Error',
        'An error occurred during face recognition. Please try again.',
        [
          { text: 'Try Again', onPress: () => setShowCamera(true) },
          { text: 'Use Password', onPress: onBack }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCameraCancel = () => {
    setShowCamera(false);
  };

  if (showCamera) {
    return (
      <FaceCapture
        onCapture={handleFaceCapture}
        onCancel={handleCameraCancel}
        title="Driver Face Login"
        subtitle="Position your face clearly for recognition"
      />
    );
  }

  return (
    <View className="flex-1 bg-gray-50 p-6">
      {/* Loading Overlay */}
      {loading && (
        <Modal transparent visible={loading}>
          <View className="flex-1 bg-black/50 justify-center items-center">
            <View className="bg-white p-6 rounded-lg items-center">
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text className="mt-4 text-gray-700">Recognizing face...</Text>
            </View>
          </View>
        </Modal>
      )}

      {/* Header */}
      <View className="flex-row items-center mb-8">
        <TouchableOpacity onPress={onBack} className="mr-4">
          <MaterialIcons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-800">Face Recognition Login</Text>
      </View>

      {/* Face Recognition Icon */}
      <View className="items-center mb-8">
        <View className="w-32 h-32 bg-blue-100 rounded-full justify-center items-center mb-4">
          <MaterialIcons name="face" size={64} color="#3B82F6" />
        </View>
        <Text className="text-lg font-semibold text-gray-800 text-center">
          Driver Authentication
        </Text>
        <Text className="text-gray-600 text-center mt-2 px-4">
          Use face recognition for quick and secure login to your driver account
        </Text>
      </View>

      {/* Instructions */}
      <View className="bg-blue-50 p-4 rounded-lg mb-8">
        <Text className="text-blue-800 font-semibold mb-2">Instructions:</Text>
        <View className="space-y-2">
          <View className="flex-row items-center">
            <MaterialIcons name="check-circle" size={16} color="#3B82F6" />
            <Text className="text-blue-700 ml-2">Look directly at the camera</Text>
          </View>
          <View className="flex-row items-center">
            <MaterialIcons name="check-circle" size={16} color="#3B82F6" />
            <Text className="text-blue-700 ml-2">Ensure good lighting</Text>
          </View>
          <View className="flex-row items-center">
            <MaterialIcons name="check-circle" size={16} color="#3B82F6" />
            <Text className="text-blue-700 ml-2">Remove any face covering</Text>
          </View>
          <View className="flex-row items-center">
            <MaterialIcons name="check-circle" size={16} color="#3B82F6" />
            <Text className="text-blue-700 ml-2">Hold steady for a clear photo</Text>
          </View>
        </View>
      </View>

      {/* Start Face Recognition Button */}
      <TouchableOpacity
        onPress={handleFaceLogin}
        disabled={loading}
        className="bg-blue-600 py-4 rounded-lg mb-4"
      >
        <View className="flex-row items-center justify-center">
          <MaterialIcons name="camera-alt" size={24} color="white" />
          <Text className="text-white font-semibold text-lg ml-2">
            Start Face Recognition
          </Text>
        </View>
      </TouchableOpacity>

      {/* Alternative Login */}
      <TouchableOpacity
        onPress={onBack}
        className="border border-gray-300 py-4 rounded-lg"
      >
        <Text className="text-gray-700 font-semibold text-center">
          Use Password Instead
        </Text>
      </TouchableOpacity>

      {/* Footer Note */}
      <View className="mt-8 p-4 bg-gray-100 rounded-lg">
        <Text className="text-gray-600 text-sm text-center">
          Face recognition data is securely encrypted and stored locally. 
          Your biometric data is never shared with third parties.
        </Text>
      </View>
    </View>
  );
};

export default FaceLogin;
