import React, { useState } from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import UserTypeSelection from './components/UserTypeSelection';
import Login from './components/Login';
import PassengerSignup from './components/PassengerSignup';
import FaceLogin from './components/FaceLogin';
import PassengerDashboard from './components/PassengerDashboard';
import DriverDashboard from './components/DriverDashboard';

import './global.css';

type LoginType = 'email' | 'face';
type ViewType = 'userSelection' | 'login' | 'signup' | 'faceLogin';

function AppContent() {
  const { user, loading, isAuthenticated, isDriver, isPassenger } = useAuth();
  const [userType, setUserType] = useState<'passenger' | 'driver'>('passenger');
  const [currentView, setCurrentView] = useState<ViewType>('userSelection');

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!isAuthenticated) {
    switch (currentView) {
      case 'userSelection':
        return (
          <UserTypeSelection
            onSelectUserType={(type) => {
              setUserType(type);
              setCurrentView('login');
            }}
          />
        );

      case 'login':
        return (
          <View className="flex-1 bg-white">
            <Login
              userType={userType}
              onSwitchUserType={() => {
                setUserType(userType === 'passenger' ? 'driver' : 'passenger');
              }}
              onShowSignup={userType === 'passenger' ? () => setCurrentView('signup') : undefined}
            />
            
            {/* Back to user selection */}
            <View className="px-6 pb-4">
              <TouchableOpacity
                onPress={() => setCurrentView('userSelection')}
                className="w-full py-3 border border-gray-300 rounded-lg"
              >
                <Text className="text-gray-600 text-center font-medium">
                  ← Back to User Selection
                </Text>
              </TouchableOpacity>
            </View>

            {/* Face recognition option for drivers */}
            {userType === 'driver' && (
              <View className="px-6 pb-8">
                <TouchableOpacity
                  onPress={() => setCurrentView('faceLogin')}
                  className="w-full py-4 bg-green-600 rounded-lg"
                >
                  <Text className="text-white text-center text-lg font-semibold">
                    Use Face Recognition
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );

      case 'signup':
        return (
          <PassengerSignup
            onBack={() => setCurrentView('login')}
            onSignupSuccess={() => setCurrentView('login')}
          />
        );

      case 'faceLogin':
        return (
          <FaceLogin 
            onBack={() => setCurrentView('login')}
          />
        );

      default:
        return (
          <UserTypeSelection
            onSelectUserType={(type) => {
              setUserType(type);
              setCurrentView('login');
            }}
          />
        );
    }
  }

  // Show appropriate dashboard based on user role
  if (isDriver) {
    return <DriverDashboard />;
  } else if (isPassenger) {
    return <PassengerDashboard />;
  }

  // Fallback (shouldn't reach here)
  return (
    <View className="flex-1 justify-center items-center bg-white">
      <Text className="text-red-600">Error: Unknown user role</Text>
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
