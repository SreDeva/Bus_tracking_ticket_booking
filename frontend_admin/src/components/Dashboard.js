import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import DriverManagement from './DriverManagement';
import UserManagement from './UserManagement';
import BusManagement from './BusManagement';
import RouteManagement from './RouteManagement';
import SOSManagement from './SOSManagement';
import BlockchainTracking from './BlockchainTracking';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('buses');

  const tabs = [
    { id: 'buses', name: 'Bus Management', component: BusManagement },
    { id: 'routes', name: 'Route Management', component: RouteManagement },
    { id: 'drivers', name: 'Driver Management', component: DriverManagement },
    { id: 'users', name: 'User Management', component: UserManagement },
    { id: 'sos', name: 'SOS Alerts', component: SOSManagement },
    { id: 'blockchain', name: 'Blockchain Tracking', component: BlockchainTracking },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Bus Tracking Admin Portal
              </h1>
              <p className="text-gray-600">Welcome, {user?.full_name}</p>
            </div>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {ActiveComponent && <ActiveComponent />}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
