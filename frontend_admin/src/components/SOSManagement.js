import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const SOSManagement = () => {
  const { token } = useAuth();
  const [sosAlerts, setSosAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, active, resolved

  useEffect(() => {
    fetchSOSAlerts();
    // Set up polling for new SOS alerts every 10 seconds
    const interval = setInterval(fetchSOSAlerts, 10000);
    return () => clearInterval(interval);
  }, [filter]);

  const fetchSOSAlerts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://10.26.181.214:8000/sos/alerts?status=${filter}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSosAlerts(data);
      } else {
        console.error('Failed to fetch SOS alerts');
      }
    } catch (error) {
      console.error('Error fetching SOS alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSOSResponse = async (alertId, action) => {
    try {
      const response = await fetch(`http://10.26.181.214:8000/sos/alerts/${alertId}/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          action,
          responded_by: 'admin',
          response_time: new Date().toISOString()
        })
      });

      if (response.ok) {
        fetchSOSAlerts(); // Refresh the list
        alert(`SOS alert ${action} successfully`);
      } else {
        alert('Failed to respond to SOS alert');
      }
    } catch (error) {
      console.error('Error responding to SOS:', error);
      alert('Error responding to SOS alert');
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      'active': 'bg-red-100 text-red-800',
      'acknowledged': 'bg-yellow-100 text-yellow-800',
      'resolved': 'bg-green-100 text-green-800'
    };
    
    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      'high': 'bg-red-500 text-white',
      'medium': 'bg-yellow-500 text-white',
      'low': 'bg-blue-500 text-white'
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${colors[priority] || 'bg-gray-500 text-white'}`}>
        {priority.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">SOS Alert Management</h2>
        <div className="flex space-x-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Alerts</option>
            <option value="active">Active Alerts</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
          <button
            onClick={fetchSOSAlerts}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* SOS Alerts Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {sosAlerts.length === 0 ? (
            <li className="px-6 py-8 text-center text-gray-500">
              {loading ? 'Loading SOS alerts...' : 'No SOS alerts found'}
            </li>
          ) : (
            sosAlerts.map((alert) => (
              <li key={alert.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className={`w-3 h-3 rounded-full ${
                            alert.status === 'active' ? 'bg-red-500 animate-pulse' :
                            alert.status === 'acknowledged' ? 'bg-yellow-500' : 'bg-green-500'
                          }`}></div>
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            SOS Alert #{alert.id}
                          </h3>
                          <div className="mt-1 text-sm text-gray-600">
                            <p><strong>Bus:</strong> {alert.bus_number} (ID: {alert.bus_id})</p>
                            <p><strong>Driver:</strong> {alert.driver_name}</p>
                            <p><strong>Location:</strong> {alert.latitude}, {alert.longitude}</p>
                            <p><strong>Time:</strong> {new Date(alert.created_at).toLocaleString()}</p>
                            {alert.message && <p><strong>Message:</strong> {alert.message}</p>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getPriorityBadge(alert.priority || 'high')}
                        {getStatusBadge(alert.status)}
                      </div>
                    </div>
                    
                    {alert.status === 'active' && (
                      <div className="mt-3 flex space-x-2">
                        <button
                          onClick={() => handleSOSResponse(alert.id, 'acknowledge')}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Acknowledge
                        </button>
                        <button
                          onClick={() => handleSOSResponse(alert.id, 'dispatch_help')}
                          className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Dispatch Help
                        </button>
                        <button
                          onClick={() => handleSOSResponse(alert.id, 'resolve')}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Mark Resolved
                        </button>
                      </div>
                    )}
                    
                    {alert.status === 'acknowledged' && (
                      <div className="mt-3 flex space-x-2">
                        <button
                          onClick={() => handleSOSResponse(alert.id, 'resolve')}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Mark Resolved
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 text-sm font-medium">Active Alerts</div>
          <div className="text-2xl font-bold text-red-900">
            {sosAlerts.filter(alert => alert.status === 'active').length}
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-yellow-800 text-sm font-medium">Acknowledged</div>
          <div className="text-2xl font-bold text-yellow-900">
            {sosAlerts.filter(alert => alert.status === 'acknowledged').length}
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-green-800 text-sm font-medium">Resolved</div>
          <div className="text-2xl font-bold text-green-900">
            {sosAlerts.filter(alert => alert.status === 'resolved').length}
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-blue-800 text-sm font-medium">Total Alerts</div>
          <div className="text-2xl font-bold text-blue-900">
            {sosAlerts.length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SOSManagement;
