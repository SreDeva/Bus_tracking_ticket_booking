import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import FaceCapture from './FaceCapture';

interface FaceRegistrationProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export const FaceRegistration: React.FC<FaceRegistrationProps> = ({ onComplete, onSkip }) => {
  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'intro' | 'capture' | 'success'>('intro');
  const { uploadFace } = useAuth();

  const handleStartRegistration = () => {
    setStep('capture');
    setShowCamera(true);
  };

  const handleFaceCapture = async (imageUri: string, base64: string) => {
    try {
      setLoading(true);
      setShowCamera(false);
      
      const result = await uploadFace(base64);
      
      if (result.success) {
        setStep('success');
        Alert.alert(
          'Face Registered Successfully!',
          'You can now use face recognition to log in quickly and securely.',
          [{ text: 'Continue', onPress: onComplete }]
        );
      } else {
        Alert.alert(
          'Registration Failed',
          result.error || 'Failed to register face. Please try again.',
          [
            { text: 'Try Again', onPress: () => setShowCamera(true) },
            { text: 'Skip', onPress: onSkip }
          ]
        );
      }
    } catch (error) {
      console.error('Face registration error:', error);
      Alert.alert(
        'Registration Error',
        'An error occurred during face registration. Please try again.',
        [
          { text: 'Try Again', onPress: () => setShowCamera(true) },
          { text: 'Skip', onPress: onSkip }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCameraCancel = () => {
    setShowCamera(false);
    setStep('intro');
  };

  if (showCamera) {
    return (
      <FaceCapture
        onCapture={handleFaceCapture}
        onCancel={handleCameraCancel}
        title="Register Your Face"
        subtitle="Take a clear photo for face recognition login"
      />
    );
  }

  if (step === 'success') {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center p-6">
        <View className="bg-white rounded-lg p-8 items-center max-w-md w-full">
          <View className="w-20 h-20 bg-green-100 rounded-full justify-center items-center mb-6">
            <MaterialIcons name="check-circle" size={40} color="#10B981" />
          </View>
          
          <Text className="text-2xl font-bold text-gray-800 text-center mb-4">
            Face Registration Complete!
          </Text>
          
          <Text className="text-gray-600 text-center mb-8">
            Your face has been successfully registered. You can now use face recognition for quick and secure login.
          </Text>
          
          <TouchableOpacity
            onPress={onComplete}
            className="bg-blue-600 py-4 px-8 rounded-lg w-full"
          >
            <Text className="text-white font-semibold text-center text-lg">
              Continue to Dashboard
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
              <Text className="mt-4 text-gray-700">Registering face...</Text>
            </View>
          </View>
        </Modal>
      )}

      {/* Header */}
      <View className="items-center mb-8">
        <View className="w-24 h-24 bg-blue-100 rounded-full justify-center items-center mb-4">
          <MaterialIcons name="face-retouching-natural" size={48} color="#3B82F6" />
        </View>
        <Text className="text-2xl font-bold text-gray-800 text-center">
          Set Up Face Recognition
        </Text>
        <Text className="text-gray-600 text-center mt-2">
          Register your face for quick and secure login
        </Text>
      </View>

      {/* Benefits */}
      <View className="bg-white rounded-lg p-6 mb-8">
        <Text className="text-lg font-semibold text-gray-800 mb-4">
          Benefits of Face Recognition:
        </Text>
        <View className="space-y-3">
          <View className="flex-row items-center">
            <MaterialIcons name="flash-on" size={20} color="#3B82F6" />
            <Text className="text-gray-700 ml-3">Quick login without typing passwords</Text>
          </View>
          <View className="flex-row items-center">
            <MaterialIcons name="security" size={20} color="#3B82F6" />
            <Text className="text-gray-700 ml-3">Secure biometric authentication</Text>
          </View>
          <View className="flex-row items-center">
            <MaterialIcons name="phone-android" size={20} color="#3B82F6" />
            <Text className="text-gray-700 ml-3">Works on any device with camera</Text>
          </View>
          <View className="flex-row items-center">
            <MaterialIcons name="privacy-tip" size={20} color="#3B82F6" />
            <Text className="text-gray-700 ml-3">Your face data stays secure and private</Text>
          </View>
        </View>
      </View>

      {/* Instructions */}
      <View className="bg-blue-50 p-4 rounded-lg mb-8">
        <Text className="text-blue-800 font-semibold mb-2">Photo Guidelines:</Text>
        <View className="space-y-2">
          <View className="flex-row items-center">
            <MaterialIcons name="check-circle-outline" size={16} color="#3B82F6" />
            <Text className="text-blue-700 ml-2">Look directly at the camera</Text>
          </View>
          <View className="flex-row items-center">
            <MaterialIcons name="check-circle-outline" size={16} color="#3B82F6" />
            <Text className="text-blue-700 ml-2">Ensure good lighting on your face</Text>
          </View>
          <View className="flex-row items-center">
            <MaterialIcons name="check-circle-outline" size={16} color="#3B82F6" />
            <Text className="text-blue-700 ml-2">Remove glasses, hats, or face coverings</Text>
          </View>
          <View className="flex-row items-center">
            <MaterialIcons name="check-circle-outline" size={16} color="#3B82F6" />
            <Text className="text-blue-700 ml-2">Keep a neutral expression</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="space-y-4">
        <TouchableOpacity
          onPress={handleStartRegistration}
          disabled={loading}
          className="bg-blue-600 py-4 rounded-lg"
        >
          <View className="flex-row items-center justify-center">
            <MaterialIcons name="camera-alt" size={24} color="white" />
            <Text className="text-white font-semibold text-lg ml-2">
              Start Face Registration
            </Text>
          </View>
        </TouchableOpacity>

        {onSkip && (
          <TouchableOpacity
            onPress={onSkip}
            className="border border-gray-300 py-4 rounded-lg"
          >
            <Text className="text-gray-700 font-semibold text-center">
              Skip for Now
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Privacy Note */}
      <View className="mt-8 p-4 bg-gray-100 rounded-lg">
        <Text className="text-gray-600 text-sm text-center">
          🔒 Your face data is encrypted and stored securely. It's never shared with third parties and can be deleted anytime.
        </Text>
      </View>
    </View>
  );
};


