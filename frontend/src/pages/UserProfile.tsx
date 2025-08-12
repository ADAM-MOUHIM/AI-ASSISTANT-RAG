import { useState } from 'react';
import { Edit2, Save, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/context/AuthContext';

export function UserProfile() {
  const { state, updateProfile } = useAuth();
  
  // Fix: Properly type the formData to match User interface
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    role: UserRole;
  }>({
    name: state.user?.name || '',
    email: state.user?.email || '',
    role: state.user?.role || 'user'
  });

  const handleSave = async () => {
    try {
      // Only send name and email for update (role is typically not editable)
      await updateProfile({
        name: formData.name,
        email: formData.email,
        // Don't include role in update as it should be managed by admin
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: state.user?.name || '',
      email: state.user?.email || '',
      role: state.user?.role || 'user'
    });
    setIsEditing(false);
  };

  if (!state.user) return null;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Profile</h2>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-2 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Edit2 size={14} />
              <span>Edit</span>
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={handleSave}
                disabled={state.isLoading}
                className="flex items-center space-x-2 px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                <span>Save</span>
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center space-x-2 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <X size={14} />
                <span>Cancel</span>
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-4">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl font-medium">
              {state.user.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">{state.user.name}</h3>
              <p className="text-sm text-gray-500">
                Joined {new Date(state.user.createdAt).toLocaleDateString()}
              </p>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                {state.user.role}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your name"
                />
              ) : (
                <p className="text-gray-900">{state.user.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              {isEditing ? (
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email"
                />
              ) : (
                <p className="text-gray-900">{state.user.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                  {state.user.role}
                </span>
                <p className="text-xs text-gray-500">Role is managed by administrators</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Status
              </label>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm text-gray-900">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      {state.stats && (
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Usage Statistics</h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{state.stats.total_conversations}</div>
                <div className="text-sm text-gray-500">Total Conversations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{state.stats.total_messages}</div>
                <div className="text-sm text-gray-500">Total Messages</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.ceil((Date.now() - new Date(state.stats.joined_date).getTime()) / (1000 * 60 * 60 * 24))}
                </div>
                <div className="text-sm text-gray-500">Days Active</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role-based content example */}
      {state.isAdmin && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-yellow-800 mb-1">Admin Access</h3>
          <p className="text-sm text-yellow-700">You have administrator privileges and can manage users and system settings.</p>
        </div>
      )}

      {/* Loading state */}
      {state.isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-700">Updating profile...</span>
          </div>
        </div>
      )}

      {/* Error display */}
      {state.error && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-red-800 mb-1">Error</h3>
              <p className="text-sm text-red-700">{state.error}</p>
            </div>
            <button
              onClick={() => {
                // You can add a clearError function to your context
                console.log('Clear error');
              }}
              className="text-red-600 hover:text-red-800"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}