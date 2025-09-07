import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';

interface UserTypeSelectionProps {
  onSelectUserType: (userType: 'passenger' | 'driver') => void;
}

const UserTypeSelection: React.FC<UserTypeSelectionProps> = ({ onSelectUserType }) => {
  return (
    <View className="flex-1 bg-white px-6 py-8 justify-center">
      {/* Header */}
      <View className="mb-12">
        <Text className="text-4xl font-bold text-center text-gray-800 mb-2">
          Bus Tracker
        </Text>
        <Text className="text-lg text-center text-gray-600">
          Choose your account type
        </Text>
      </View>

      {/* User Type Cards */}
      <View className="space-y-6">
        {/* Passenger Card */}
        <TouchableOpacity
          onPress={() => onSelectUserType('passenger')}
          className="bg-blue-50 border-2 border-blue-200 rounded-xl p-8 items-center"
        >
          <View className="w-16 h-16 bg-blue-600 rounded-full items-center justify-center mb-4">
            <Text className="text-white text-2xl">👤</Text>
          </View>
          <Text className="text-2xl font-bold text-blue-800 mb-2">
            Passenger
          </Text>
          <Text className="text-center text-blue-600 text-base">
            Book rides, track buses, and manage your travel
          </Text>
          <View className="mt-4 bg-blue-600 px-6 py-2 rounded-lg">
            <Text className="text-white font-semibold">Continue as Passenger</Text>
          </View>
        </TouchableOpacity>

        {/* Driver Card */}
        <TouchableOpacity
          onPress={() => onSelectUserType('driver')}
          className="bg-green-50 border-2 border-green-200 rounded-xl p-8 items-center"
        >
          <View className="w-16 h-16 bg-green-600 rounded-full items-center justify-center mb-4">
            <Text className="text-white text-2xl">🚌</Text>
          </View>
          <Text className="text-2xl font-bold text-green-800 mb-2">
            Driver
          </Text>
          <Text className="text-center text-green-600 text-base">
            Manage routes, update location, and serve passengers
          </Text>
          <View className="mt-4 bg-green-600 px-6 py-2 rounded-lg">
            <Text className="text-white font-semibold">Continue as Driver</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View className="mt-12">
        <Text className="text-center text-gray-500 text-sm">
          Select your role to continue with the appropriate login process
        </Text>
      </View>
    </View>
  );
};

export default UserTypeSelection;
