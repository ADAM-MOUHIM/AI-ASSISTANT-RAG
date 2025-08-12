// src/components/layout/UserMenu.tsx
import { Link, useNavigate } from 'react-router-dom';
import { User, Settings, Bell, Moon, HelpCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface UserMenuProps {
  onClose?: () => void;
}

export function UserMenu({ onClose }: UserMenuProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const displayName =
    user?.name || user?.username || (user?.email ? user.email.split('@')[0] : 'User');
  const email = user?.email ?? '';

  const initials = displayName
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    try {
      await logout();
      onClose?.();
      navigate('/login', { replace: true });
    } catch (e) {
      console.error('Sign out failed', e);
    }
  };

  const menuItemClass =
    'flex items-center space-x-3 px-3 py-2 text-sm hover:bg-gray-50 rounded-md transition-colors w-full';

  return (
    <div className="bg-white rounded-lg shadow-lg border p-2 min-w-[220px]">
      {/* User Info */}
      <div className="px-3 py-2 border-b border-gray-100 mb-2">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{displayName}</p>
            <p className="text-xs text-gray-500 truncate">{email}</p>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="space-y-1">
        <Link to="/profile" className={menuItemClass} onClick={onClose}>
          <User className="w-4 h-4 text-gray-500" />
          <span>Profile</span>
        </Link>
        <Link to="/settings" className={menuItemClass} onClick={onClose}>
          <Settings className="w-4 h-4 text-gray-500" />
          <span>Settings</span>
        </Link>
        <Link to="/notifications" className={menuItemClass} onClick={onClose}>
          <Bell className="w-4 h-4 text-gray-500" />
          <span>Notifications</span>
        </Link>
        <Link to="/appearance" className={menuItemClass} onClick={onClose}>
          <Moon className="w-4 h-4 text-gray-500" />
          <span>Appearance</span>
        </Link>
      </div>

      <div className="border-t border-gray-100 my-2" />

      <div className="space-y-1">
        <Link to="/help" className={menuItemClass} onClick={onClose}>
          <HelpCircle className="w-4 h-4 text-gray-500" />
          <span>Help & Support</span>
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center space-x-3 px-3 py-2 text-sm hover:bg-red-50 rounded-md transition-colors text-red-600 w-full"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}
