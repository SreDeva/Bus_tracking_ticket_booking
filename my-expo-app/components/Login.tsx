import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

interface LoginProps {
  userType: 'passenger' | 'driver';
  onSwitchUserType: () => void;
  onShowSignup?: () => void;
}

const Login: React.FC<LoginProps> = ({ userType, onSwitchUserType, onShowSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Login Failed', result.error || 'Unknown error occurred');
    }
  };

  return (
    <View className="flex-1 bg-white px-6 py-8 justify-center">
      <View className="mb-8">
        <Text className="text-3xl font-bold text-center text-gray-800">
          Bus Tracker
        </Text>
        <Text className="text-lg text-center text-gray-600 mt-2">
          {userType === 'passenger' ? 'Passenger Login' : 'Driver Login'}
        </Text>
      </View>

      <View className="space-y-4">
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-2">Email</Text>
          <TextInput
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-2">Password</Text>
          <TextInput
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />
        </View>

        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          className={`w-full py-4 rounded-lg mt-6 ${
            loading ? 'bg-gray-400' : 'bg-blue-600'
          }`}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center text-lg font-semibold">
              Sign In
            </Text>
          )}
        </TouchableOpacity>

        {/* Signup option for passengers */}
        {userType === 'passenger' && onShowSignup && (
          <TouchableOpacity
            onPress={onShowSignup}
            className="w-full py-4 border border-blue-600 rounded-lg mt-4"
          >
            <Text className="text-blue-600 text-center text-lg font-semibold">
              Create New Account
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={onSwitchUserType}
          className="mt-4"
        >
          <Text className="text-blue-600 text-center">
            {userType === 'passenger' 
              ? 'Are you a driver? Switch to driver login' 
              : 'Are you a passenger? Switch to passenger login'
            }
          </Text>
        </TouchableOpacity>

        {userType === 'passenger' && !onShowSignup && (
          <View className="mt-6 p-4 bg-gray-100 rounded-lg">
            <Text className="text-sm text-gray-600 text-center">
              New passenger? You can create an account above.
            </Text>
          </View>
        )}

        {userType === 'driver' && (
          <View className="mt-6 p-4 bg-blue-50 rounded-lg">
            <Text className="text-sm text-blue-800 text-center">
              Drivers are registered by admin. If you don't have credentials, contact your administrator.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default Login;
