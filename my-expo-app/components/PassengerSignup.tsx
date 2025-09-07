import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';

// For Android emulator, use 10.0.2.2 instead of localhost
const API_BASE_URL = 'http://10.26.181.214:8000'; // Android emulator

interface PassengerSignupProps {
  onBack: () => void;
  onSignupSuccess: () => void;
}

const PassengerSignup: React.FC<PassengerSignupProps> = ({ onBack, onSignupSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.email || !formData.full_name || !formData.password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    if (formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register/passenger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone || null,
          password: formData.password,
          role: 'passenger'
        }),
      });

      if (response.ok) {
        Alert.alert(
          'Success',
          'Account created successfully! You can now log in.',
          [{ text: 'OK', onPress: onSignupSuccess }]
        );
      } else {
        const errorData = await response.json();
        Alert.alert('Signup Failed', errorData.detail || 'Failed to create account');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-6 py-8 pt-12">
        {/* Header */}
        <View className="mb-8">
          <Text className="text-3xl font-bold text-center text-gray-800">
            Create Passenger Account
          </Text>
          <Text className="text-lg text-center text-gray-600 mt-2">
            Join our bus tracking system
          </Text>
        </View>

        {/* Form */}
        <View className="space-y-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </Text>
            <TextInput
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500"
              placeholder="Enter your full name"
              value={formData.full_name}
              onChangeText={(value) => handleInputChange('full_name', value)}
              autoCapitalize="words"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </Text>
            <TextInput
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500"
              placeholder="Enter your email"
              value={formData.email}
              onChangeText={(value) => handleInputChange('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Phone Number (Optional)
            </Text>
            <TextInput
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500"
              placeholder="Enter your phone number"
              value={formData.phone}
              onChangeText={(value) => handleInputChange('phone', value)}
              keyboardType="phone-pad"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Password *
            </Text>
            <TextInput
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500"
              placeholder="Create a password (min 6 characters)"
              value={formData.password}
              onChangeText={(value) => handleInputChange('password', value)}
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Confirm Password *
            </Text>
            <TextInput
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChangeText={(value) => handleInputChange('confirmPassword', value)}
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          {/* Signup Button */}
          <TouchableOpacity
            onPress={handleSignup}
            disabled={loading}
            className={`w-full py-4 rounded-lg mt-6 ${
              loading ? 'bg-gray-400' : 'bg-blue-600'
            }`}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center text-lg font-semibold">
                Create Account
              </Text>
            )}
          </TouchableOpacity>

          {/* Back Button */}
          <TouchableOpacity
            onPress={onBack}
            className="w-full py-4 border border-gray-300 rounded-lg mt-4"
          >
            <Text className="text-gray-700 text-center text-lg font-semibold">
              Back to Login
            </Text>
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <View className="mt-6 p-4 bg-gray-50 rounded-lg">
          <Text className="text-sm text-gray-600 text-center">
            By creating an account, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

export default PassengerSignup;
