const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getAuthHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Something went wrong');
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  // Auth endpoints
  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async registerPassenger(userData) {
    return this.request('/auth/register/passenger', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // User management
  async getUsers(skip = 0, limit = 100) {
    return this.request(`/users/?skip=${skip}&limit=${limit}`);
  }

  async getUsersByRole(role, skip = 0, limit = 100) {
    return this.request(`/auth/users/${role}?skip=${skip}&limit=${limit}`);
  }

  async createUser(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId, userData) {
    return this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(userId) {
    return this.request(`/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // Driver management
  async getDrivers(skip = 0, limit = 100) {
    return this.request(`/users/drivers/?skip=${skip}&limit=${limit}`);
  }

  async createDriver(userData, driverData) {
    return this.request('/auth/register/driver', {
      method: 'POST',
      body: JSON.stringify({ ...userData, ...driverData }),
    });
  }

  async updateDriver(driverId, driverData) {
    return this.request(`/users/drivers/${driverId}`, {
      method: 'PUT',
      body: JSON.stringify(driverData),
    });
  }

  async deleteDriver(driverId) {
    return this.request(`/users/drivers/${driverId}`, {
      method: 'DELETE',
    });
  }

  // Face upload for drivers
  async uploadDriverFace(driverId, images) {
    return this.request('/auth/upload-driver-face', {
      method: 'POST',
      body: JSON.stringify({
        driver_id: driverId,
        images: images,
      }),
    });
  }

  // Bus management endpoints
  async getBuses(skip = 0, limit = 100) {
    return this.request(`/buses/?skip=${skip}&limit=${limit}`);
  }

  async createBus(busData) {
    return this.request('/buses/', {
      method: 'POST',
      body: JSON.stringify(busData),
    });
  }

  async updateBus(busId, busData) {
    return this.request(`/buses/${busId}`, {
      method: 'PUT',
      body: JSON.stringify(busData),
    });
  }

  async deleteBus(busId) {
    return this.request(`/buses/${busId}`, {
      method: 'DELETE',
    });
  }

  async getBusQRInfo(busId) {
    return this.request(`/buses/${busId}/qr-info`);
  }

  async recordGPSLocation(locationData) {
    return this.request('/buses/gps-location', {
      method: 'POST',
      body: JSON.stringify(locationData),
    });
  }

  async getAvailableDrivers() {
    return this.request('/buses/available-drivers/');
  }

  // Route management endpoints
  async getRoutes(skip = 0, limit = 100) {
    return this.request(`/buses/routes/?skip=${skip}&limit=${limit}`);
  }

  async createRoute(busId, routeData) {
    return this.request(`/buses/${busId}/routes`, {
      method: 'POST',
      body: JSON.stringify(routeData),
    });
  }

  async updateRoute(routeId, routeData) {
    return this.request(`/buses/routes/${routeId}`, {
      method: 'PUT',
      body: JSON.stringify(routeData),
    });
  }

  async deleteRoute(routeId) {
    return this.request(`/buses/routes/${routeId}`, {
      method: 'DELETE',
    });
  }

  async getRouteStops(routeId) {
    return this.request(`/buses/routes/${routeId}/stops`);
  }

  // Utility method to convert file to base64
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]; // Remove data:image/...;base64, prefix
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  }
}

export default new ApiService();
