import { useState } from 'react';
import { Moon, Sun, Volume2, VolumeX, Globe, Shield } from 'lucide-react';

export function UserSettings() {
  const [settings, setSettings] = useState({
    theme: 'light',
    notifications: true,
    sounds: true,
    language: 'en',
    privacy: 'standard',
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Settings</h2>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Theme Setting */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {settings.theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
              <div>
                <h3 className="text-sm font-medium text-gray-900">Theme</h3>
                <p className="text-sm text-gray-500">Choose your preferred theme</p>
              </div>
            </div>
            <select
              value={settings.theme}
              onChange={(e) => handleSettingChange('theme', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>

          {/* Notifications Setting */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Volume2 size={20} />
              <div>
                <h3 className="text-sm font-medium text-gray-900">Notifications</h3>
                <p className="text-sm text-gray-500">Receive push notifications</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) => handleSettingChange('notifications', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Sounds Setting */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {settings.sounds ? <Volume2 size={20} /> : <VolumeX size={20} />}
              <div>
                <h3 className="text-sm font-medium text-gray-900">Sounds</h3>
                <p className="text-sm text-gray-500">Play sounds for notifications</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.sounds}
                onChange={(e) => handleSettingChange('sounds', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Language Setting */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Globe size={20} />
              <div>
                <h3 className="text-sm font-medium text-gray-900">Language</h3>
                <p className="text-sm text-gray-500">Choose your language</p>
              </div>
            </div>
            <select
              value={settings.language}
              onChange={(e) => handleSettingChange('language', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
              <option value="de">German</option>
            </select>
          </div>

          {/* Privacy Setting */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield size={20} />
              <div>
                <h3 className="text-sm font-medium text-gray-900">Privacy</h3>
                <p className="text-sm text-gray-500">Control your privacy settings</p>
              </div>
            </div>
            <select
              value={settings.privacy}
              onChange={(e) => handleSettingChange('privacy', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="public">Public</option>
              <option value="standard">Standard</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200">
          <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}