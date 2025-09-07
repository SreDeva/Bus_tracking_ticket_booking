import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// For Android emulator, use 10.0.2.2 instead of localhost
// For iOS simulator, use localhost
// For physical device, use your computer's IP address
// const API_BASE_URL = 'http://10.123.168.214:8000'; // Android emulator
// const API_BASE_URL = 'http://localhost:8000'; // iOS simulator
// const API_BASE_URL = 'http://10.123.168.214:8000'; // Physical device (replace with your IP)
// API Configuration - Choose one based on your setup
const API_CONFIGS = {
  ANDROID_EMULATOR: 'http://10.123.168.214:8000',
  IOS_SIMULATOR: 'http://localhost:8000', 
  PHYSICAL_DEVICE: 'http://10.123.168.214:8000', // Replace with your IP
};

// Set the active configuration here
const API_BASE_URL = API_CONFIGS.PHYSICAL_DEVICE;
interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  role: 'admin' | 'driver' | 'passenger';
  is_active: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  loginWithFace: (faceImageBase64: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  uploadFace: (faceImageBase64: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  loading: boolean;
  isAuthenticated: boolean;
  isDriver: boolean;
  isPassenger: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (storedToken) {
        setToken(storedToken);
        await fetchUserProfile(storedToken);
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async (authToken: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        return true;
      } else {
        await logout();
        return false;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      await logout();
      return false;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Only allow drivers and passengers
        if (!['driver', 'passenger'].includes(data.user.role)) {
          return { success: false, error: 'Access denied. Use admin portal for admin access.' };
        }

        await AsyncStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        setUser(data.user);
        return { success: true, user: data.user };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.detail };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  };

  const loginWithFace = async (faceImageBase64: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/face/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_data: faceImageBase64 }),
      });

      if (response.ok) {
        const data = await response.json();
        
        await AsyncStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        setUser(data.user);
        return { success: true, user: data.user };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.detail };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  };

  const uploadFace = async (faceImageBase64: string) => {
    try {
      if (!token) {
        return { success: false, error: 'Authentication required' };
      }

      const response = await fetch(`${API_BASE_URL}/auth/face/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ image_data: faceImageBase64 }),
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.detail };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    loginWithFace,
    uploadFace,
    logout,
    loading,
    isAuthenticated: !!user,
    isDriver: user?.role === 'driver',
    isPassenger: user?.role === 'passenger',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
