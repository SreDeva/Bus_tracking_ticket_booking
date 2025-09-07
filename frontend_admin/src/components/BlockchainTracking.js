import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const BlockchainTracking = () => {
  const { token } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({
    busId: '',
    driverId: '',
    timeRange: '24h'
  });
  const [activeTab, setActiveTab] = useState('assignments');

  useEffect(() => {
    fetchBlockchainData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchBlockchainData, 30000);
    return () => clearInterval(interval);
  }, [filter]);

  const fetchBlockchainData = async () => {
    setLoading(true);
    try {
      // Fetch assignment events from blockchain
      const eventsResponse = await fetch('http://127.0.0.1:8001/events/assignments', {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        setEvents(eventsData);
      }

      // If filter has busId, fetch specific bus assignments
      if (filter.busId) {
        const busResponse = await fetch(`http://127.0.0.1:8001/bus/${filter.busId}/drivers`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (busResponse.ok) {
          const busData = await busResponse.json();
          setAssignments(busData);
        }
      }

      // If filter has driverId, fetch specific driver assignments
      if (filter.driverId) {
        const driverResponse = await fetch(`http://127.0.0.1:8001/driver/${filter.driverId}/buses`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (driverResponse.ok) {
          const driverData = await driverResponse.json();
          setAssignments(driverData);
        }
      }

    } catch (error) {
      console.error('Error fetching blockchain data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const filterEventsByTime = (events) => {
    const now = Date.now() / 1000;
    const timeRanges = {
      '1h': 3600,
      '24h': 86400,
      '7d': 604800,
      '30d': 2592000
    };

    const range = timeRanges[filter.timeRange] || 86400;
    return events.filter(event => (now - event.timestamp) <= range);
  };

  const handleSearch = () => {
    fetchBlockchainData();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Blockchain Assignment Tracking</h2>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span>Live blockchain data</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Search & Filter</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bus ID</label>
            <input
              type="text"
              value={filter.busId}
              onChange={(e) => setFilter({...filter, busId: e.target.value})}
              placeholder="Enter bus ID"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Driver ID</label>
            <input
              type="text"
              value={filter.driverId}
              onChange={(e) => setFilter({...filter, driverId: e.target.value})}
              placeholder="Enter driver ID"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
            <select
              value={filter.timeRange}
              onChange={(e) => setFilter({...filter, timeRange: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('assignments')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'assignments'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Assignment History
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'events'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Blockchain Events
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'assignments' && (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Driver Assignments</h3>
            {assignments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {loading ? 'Loading assignments...' : 'No assignments found. Try searching with Bus ID or Driver ID.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bus ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {assignments.map((assignment, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {assignment.busId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {assignment.driverId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {assignment.source} → {assignment.destination}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatTimestamp(assignment.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Blockchain Events</h3>
            {filterEventsByTime(events).length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {loading ? 'Loading events...' : 'No blockchain events found for the selected time range.'}
              </p>
            ) : (
              <div className="space-y-4">
                {filterEventsByTime(events).map((event) => (
                  <div key={event.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">
                            Assignment Recorded #{event.id}
                          </h4>
                          <p className="text-sm text-gray-500">
                            Bus {event.busId} assigned to Driver {event.driverId}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <p>{formatTimestamp(event.timestamp)}</p>
                        <p className="text-xs">Block #{event.blockNumber}</p>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      <p>Transaction: <span className="font-mono">{event.txHash}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-blue-800 text-sm font-medium">Total Events</div>
          <div className="text-2xl font-bold text-blue-900">
            {events.length}
          </div>
          <p className="text-xs text-blue-600 mt-1">All time</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-green-800 text-sm font-medium">Recent Events</div>
          <div className="text-2xl font-bold text-green-900">
            {filterEventsByTime(events).length}
          </div>
          <p className="text-xs text-green-600 mt-1">In selected time range</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-purple-800 text-sm font-medium">Active Assignments</div>
          <div className="text-2xl font-bold text-purple-900">
            {assignments.length}
          </div>
          <p className="text-xs text-purple-600 mt-1">Current search results</p>
        </div>
      </div>
    </div>
  );
};

export default BlockchainTracking;
