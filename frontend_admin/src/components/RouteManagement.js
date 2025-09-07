import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import RouteMapViewer from './RouteMapViewer';

const RouteManagement = () => {
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showMapViewer, setShowMapViewer] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState(null);

  const [formData, setFormData] = useState({
    route_name: '',
    origin: '',
    destination: '',
    distance_km: '',
    estimated_duration_minutes: '',
    bus_id: '',
    driver_id: '',
    stops: []
  });

  const [currentStop, setCurrentStop] = useState({
    stop_name: '',
    location_name: '',
    stop_order: 1,
    latitude: '',
    longitude: ''
  });

  const { token } = useAuth();

  useEffect(() => {
    fetchRoutes();
    fetchBuses();
    fetchDrivers();
  }, []);

  const fetchRoutes = async () => {
    try {
      const response = await apiService.getRoutes();
      setRoutes(response);
    } catch (error) {
      setError('Failed to fetch routes');
      console.error('Error fetching routes:', error);
    }
  };

  const fetchBuses = async () => {
    try {
      const response = await apiService.getBuses();
      setBuses(response);
    } catch (error) {
      console.error('Error fetching buses:', error);
    }
  };

  const fetchDrivers = async () => {
    try {
      const response = await apiService.getAvailableDrivers();
      setDrivers(response);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const routeData = {
        ...formData,
        distance_km: parseFloat(formData.distance_km),
        estimated_duration_minutes: parseInt(formData.estimated_duration_minutes),
        bus_id: parseInt(formData.bus_id),
        driver_id: parseInt(formData.driver_id),
        stops: formData.stops
      };
      
      await apiService.createRoute(routeData.bus_id, routeData);
      setSuccess('Route assigned successfully with ' + formData.stops.length + ' stops');
      setShowAddForm(false);
      resetForm();
      fetchRoutes();
      fetchDrivers();
    } catch (error) {
      setError(error.message || 'Failed to assign route');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      route_name: '',
      origin: '',
      destination: '',
      distance_km: '',
      estimated_duration_minutes: '',
      bus_id: '',
      driver_id: '',
      stops: []
    });
    setCurrentStop({
      stop_name: '',
      location_name: '',
      stop_order: 1,
      latitude: '',
      longitude: ''
    });
  };

  const addStop = () => {
    if (!currentStop.stop_name || !currentStop.location_name) return;
    
    const newStop = {
      ...currentStop,
      stop_order: formData.stops.length + 1,
      latitude: currentStop.latitude ? parseFloat(currentStop.latitude) : null,
      longitude: currentStop.longitude ? parseFloat(currentStop.longitude) : null
    };
    
    setFormData({
      ...formData,
      stops: [...formData.stops, newStop]
    });
    
    setCurrentStop({
      stop_name: '',
      location_name: '',
      stop_order: formData.stops.length + 2,
      latitude: '',
      longitude: ''
    });
  };

  const removeStop = (index) => {
    const updatedStops = formData.stops.filter((_, i) => i !== index);
    // Reorder the remaining stops
    const reorderedStops = updatedStops.map((stop, i) => ({
      ...stop,
      stop_order: i + 1
    }));
    
    setFormData({
      ...formData,
      stops: reorderedStops
    });
  };

  const handleDeleteRoute = async (routeId) => {
    console.log('handleDeleteRoute called with routeId:', routeId);
    if (!window.confirm('Are you sure you want to delete this route assignment?')) {
      return;
    }
    
    setLoading(true);
    try {
      await apiService.deleteRoute(routeId);
      setSuccess('Route assignment deleted successfully');
      fetchRoutes();
      fetchDrivers();
    } catch (error) {
      setError(error.message || 'Failed to delete route assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleViewOnMap = (routeId) => {
    console.log('handleViewOnMap called with routeId:', routeId);
    console.log('Current auth state:', { 
      token: localStorage.getItem('token') ? 'EXISTS' : 'NULL',
      tokenLength: localStorage.getItem('token')?.length || 0
    });
    setSelectedRouteId(routeId);
    setShowMapViewer(true);
  };

  const handleCloseMapViewer = () => {
    setShowMapViewer(false);
    setSelectedRouteId(null);
  };

  const getBusNumber = (busId) => {
    const bus = buses.find(b => b.id === busId);
    return bus ? bus.bus_number : 'Unknown';
  };

  const getDriverName = (driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    return driver ? driver.user.full_name : 'Unknown';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isRouteExpired = (createdAt) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now - created);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 1;
  };

  if (loading && routes.length === 0) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Route Assignment Management</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Assign Route to Bus & Driver
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          <button onClick={() => setError('')} className="float-right font-bold">×</button>
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
          <button onClick={() => setSuccess('')} className="float-right font-bold">×</button>
        </div>
      )}

      {/* Add Route Assignment Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
            <h2 className="text-xl font-bold mb-4">Assign Route to Bus & Driver</h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4">
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Route Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Chennai to Bangalore Express"
                    value={formData.route_name}
                    onChange={(e) => setFormData({...formData, route_name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Select Bus
                  </label>
                  <select
                    value={formData.bus_id}
                    onChange={(e) => setFormData({...formData, bus_id: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="">Choose a bus...</option>
                    {buses.map(bus => (
                      <option key={bus.id} value={bus.id}>
                        {bus.bus_number} - {bus.bus_type} ({bus.capacity} seats)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Select Driver
                  </label>
                  <select
                    value={formData.driver_id}
                    onChange={(e) => setFormData({...formData, driver_id: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="">Choose a driver...</option>
                    {drivers.map(driver => (
                      <option key={driver.id} value={driver.id}>
                        {driver.user.full_name} - License: {driver.license_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Origin
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Chennai"
                    value={formData.origin}
                    onChange={(e) => setFormData({...formData, origin: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Destination
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Bangalore"
                    value={formData.destination}
                    onChange={(e) => setFormData({...formData, destination: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Distance (KM)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 350.5"
                    value={formData.distance_km}
                    onChange={(e) => setFormData({...formData, distance_km: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Estimated Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 420"
                    value={formData.estimated_duration_minutes}
                    onChange={(e) => setFormData({...formData, estimated_duration_minutes: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Bus Stops Section */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Bus Stops</h3>
                
                {/* Add Stop Form */}
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <h4 className="font-medium mb-3">Add Bus Stop</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Stop Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Central Bus Station"
                        value={currentStop.stop_name}
                        onChange={(e) => setCurrentStop({...currentStop, stop_name: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Location/Area Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., T. Nagar, Chennai"
                        value={currentStop.location_name}
                        onChange={(e) => setCurrentStop({...currentStop, location_name: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Latitude (Optional)
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        placeholder="e.g., 13.0475"
                        value={currentStop.latitude}
                        onChange={(e) => setCurrentStop({...currentStop, latitude: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm font-bold mb-2">
                        Longitude (Optional)
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        placeholder="e.g., 80.2785"
                        value={currentStop.longitude}
                        onChange={(e) => setCurrentStop({...currentStop, longitude: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addStop}
                    disabled={!currentStop.stop_name || !currentStop.location_name}
                    className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Add Stop
                  </button>
                </div>

                {/* Added Stops List */}
                {formData.stops.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-3">Added Stops ({formData.stops.length})</h4>
                    <div className="space-y-2">
                      {formData.stops.map((stop, index) => (
                        <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg border">
                          <div className="flex-1">
                            <div className="font-medium">{stop.stop_order}. {stop.stop_name}</div>
                            <div className="text-sm text-gray-600">{stop.location_name}</div>
                            {stop.latitude && stop.longitude && (
                              <div className="text-xs text-gray-500">
                                Coordinates: {stop.latitude}, {stop.longitude}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeStop(index)}
                            className="ml-4 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Assigning...' : 'Assign Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Route Assignments Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Route Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Origin → Destination
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bus
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Driver
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Distance/Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assigned Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {routes.map((route) => {
              console.log('Rendering route:', route);
              return (
              <tr key={route.id} className={isRouteExpired(route.created_at) ? 'bg-red-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {route.route_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {route.origin} → {route.destination}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {getBusNumber(route.bus_id)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {route.driver_id ? getDriverName(route.driver_id) : 'Not assigned'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {route.distance_km}km / {Math.floor(route.estimated_duration_minutes / 60)}h {route.estimated_duration_minutes % 60}m
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(route.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    isRouteExpired(route.created_at) ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {isRouteExpired(route.created_at) ? 'Expired' : 'Active'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleViewOnMap(route.id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      title="View on Map"
                    >
                      🗺️ Map
                    </button>
                    <button
                      onClick={() => handleDeleteRoute(route.id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {routes.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No route assignments found. Create your first route assignment to get started.
          </div>
        )}
      </div>

      {/* Auto-deletion notice */}
      <div className="mt-4 p-4 bg-yellow-100 border border-yellow-400 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> Route assignments are valid for 1 day only and will be automatically marked as expired after 24 hours.
        </p>
      </div>

      {/* Map Viewer */}
      {showMapViewer && selectedRouteId && (
        <RouteMapViewer
          routeId={selectedRouteId}
          onClose={handleCloseMapViewer}
        />
      )}
    </div>
  );
};

export default RouteManagement;
