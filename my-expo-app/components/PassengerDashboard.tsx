import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const PassengerDashboard: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-blue-600 px-6 py-8 pt-12">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-white text-2xl font-bold">
              Welcome, {user?.full_name}
            </Text>
            <Text className="text-blue-100 text-sm">
              Passenger Dashboard
            </Text>
          </View>
          <TouchableOpacity
            onPress={logout}
            className="bg-blue-700 px-4 py-2 rounded-lg"
          >
            <Text className="text-white font-semibold">Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Actions */}
      <View className="px-6 py-6">
        <Text className="text-xl font-bold text-gray-800 mb-4">
          Quick Actions
        </Text>
        
        <View className="grid grid-cols-2 gap-4">
          <TouchableOpacity className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <Text className="text-lg font-semibold text-gray-800 mb-2">
              Find Bus
            </Text>
            <Text className="text-gray-600 text-sm">
              Search for available buses
            </Text>
          </TouchableOpacity>

          <TouchableOpacity className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <Text className="text-lg font-semibold text-gray-800 mb-2">
              Track Bus
            </Text>
            <Text className="text-gray-600 text-sm">
              Real-time bus tracking
            </Text>
          </TouchableOpacity>

          <TouchableOpacity className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <Text className="text-lg font-semibold text-gray-800 mb-2">
              My Bookings
            </Text>
            <Text className="text-gray-600 text-sm">
              View your reservations
            </Text>
          </TouchableOpacity>

          <TouchableOpacity className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <Text className="text-lg font-semibold text-gray-800 mb-2">
              Profile
            </Text>
            <Text className="text-gray-600 text-sm">
              Manage your account
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity */}
      <View className="px-6 py-4">
        <Text className="text-xl font-bold text-gray-800 mb-4">
          Recent Activity
        </Text>
        
        <View className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <Text className="text-gray-600 text-center">
            No recent activity to show
          </Text>
        </View>
      </View>

      {/* User Info */}
      <View className="px-6 py-4 mb-6">
        <View className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <Text className="text-lg font-semibold text-gray-800 mb-2">
            Account Information
          </Text>
          <View className="space-y-2">
            <Text className="text-gray-600">
              <Text className="font-medium">Email:</Text> {user?.email}
            </Text>
            {user?.phone && (
              <Text className="text-gray-600">
                <Text className="font-medium">Phone:</Text> {user.phone}
              </Text>
            )}
            <Text className="text-gray-600">
              <Text className="font-medium">Role:</Text> {user?.role}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default PassengerDashboard;
