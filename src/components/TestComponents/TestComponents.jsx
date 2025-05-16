import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMonetization } from '../hooks/useMonetization';

const UserProfile = () => {
  const { currentUser, updateUserProfile } = useAuth();
  const { currentSubscription } = useMonetization();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: currentUser?.fullName || '',
    email: currentUser?.email || '',
    company: currentUser?.company || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateUserProfile(formData);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  const getPlanBadgeColor = () => {
    if (!currentSubscription) return 'bg-gray-100 text-gray-800';
    
    switch (currentSubscription.planName.toLowerCase()) {
      case 'free':
        return 'bg-gray-100 text-gray-800';
      case 'basic':
        return 'bg-blue-100 text-blue-800';
      case 'pro':
        return 'bg-purple-100 text-purple-800';
      case 'enterprise':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };
  
  if (!currentUser) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-5 bg-gray-200 rounded w-2/3 mb-2"></div>
          <div className="h-5 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 bg-gray-50 flex justify-between items-center">
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900">User Profile</h3>
          <p className="max-w-2xl text-sm text-gray-500">
            Personal details and subscription information
          </p>
        </div>
        <div>
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getPlanBadgeColor()}`}>
            {currentSubscription ? currentSubscription.planName : 'Free'}
          </span>
        </div>
      </div>
      
      <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
        {isEditing ? (
          <div className="space-y-6">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                id="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                value={formData.email}
                onChange={handleInputChange}
                className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                disabled
              />
              <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
            </div>
            
            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700">
                Company
              </label>
              <input
                type="text"
                name="company"
                id="company"
                value={formData.company}
                onChange={handleInputChange}
                className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Full name</dt>
                <dd className="mt-1 text-sm text-gray-900">{currentUser.fullName || 'Not provided'}</dd>
              </div>
              
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Email address</dt>
                <dd className="mt-1 text-sm text-gray-900">{currentUser.email}</dd>
              </div>
              
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Company</dt>
                <dd className="mt-1 text-sm text-gray-900">{currentUser.company || 'Not provided'}</dd>
              </div>
              
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Joined</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(currentUser.createdAt).toLocaleDateString()}
                </dd>
              </div>
              
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Current subscription</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {currentSubscription ? (
                    <div className="flex flex-col">
                      <span className="font-medium">{currentSubscription.planName}</span>
                      <span className="text-gray-500">
                        {currentSubscription.interval === 'month' ? 'Monthly' : 'Annual'} billing · 
                        Next invoice on {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                      </span>
                      <a href="/subscription" className="text-indigo-600 hover:text-indigo-500 mt-1">
                        Manage subscription
                      </a>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <span>No active subscription</span>
                      <a href="/pricing" className="text-indigo-600 hover:text-indigo-500 mt-1">
                        View plans
                      </a>
                    </div>
                  )}
                </dd>
              </div>
            </dl>
            
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Edit Profile
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="border-t border-gray-200 px-4 py-5 sm:px-6 bg-gray-50">
        <h4 className="text-sm font-medium text-gray-500">Account Security</h4>
        <div className="mt-3 flex">
          <a
            href="/change-password"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Change password
          </a>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;