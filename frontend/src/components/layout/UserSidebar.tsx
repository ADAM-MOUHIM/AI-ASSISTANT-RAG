// layout/UserSidebar.tsx - User sidebar navigation
import { User, Settings, Bell, HelpCircle, LogOut } from 'lucide-react';
import { useUser } from '@/context/UserContext';

type UserView = 'profile' | 'settings' | 'notifications' | 'help';

interface UserSidebarProps {
  currentView: UserView;
  onViewChange: (view: UserView) => void;
}

export function UserSidebar({ currentView, onViewChange }: UserSidebarProps) {
  const { state, logout } = useUser();
  
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (!state.user) return null;

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* User Profile Section */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
            {state.user.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {state.user.name}
            </h3>
            <p className="text-xs text-gray-500 truncate">
              {state.user.email}
            </p>
          </div>
        </div>
        
        {/* User Stats */}
        {state.stats && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white rounded p-2 text-center">
              <div className="font-medium text-gray-900">{state.stats.total_conversations}</div>
              <div className="text-gray-500">Chats</div>
            </div>
            <div className="bg-white rounded p-2 text-center">
              <div className="font-medium text-gray-900">{state.stats.total_messages}</div>
              <div className="text-gray-500">Messages</div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-2">
        <div className="space-y-1">
          <SidebarItem 
            icon={User} 
            label="Profile" 
            active={currentView === 'profile'}
            onClick={() => onViewChange('profile')}
          />
          <SidebarItem 
            icon={Settings} 
            label="Settings" 
            active={currentView === 'settings'}
            onClick={() => onViewChange('settings')}
          />
          <SidebarItem 
            icon={Bell} 
            label="Notifications" 
            active={currentView === 'notifications'}
            onClick={() => onViewChange('notifications')}
            badge={state.notifications.filter(n => !n.read).length}
          />
          <SidebarItem 
            icon={HelpCircle} 
            label="Help & Support" 
            active={currentView === 'help'}
            onClick={() => onViewChange('help')}
          />
        </div>
      </nav>

      {/* Sign Out Button */}
      <div className="p-2 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          disabled={state.isLoading}
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}

function SidebarItem({ 
  icon: Icon, 
  label, 
  badge,
  active,
  onClick
}: { 
  icon: any; 
  label: string; 
  badge?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
        active 
          ? 'bg-blue-100 text-blue-700' 
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center space-x-3">
        <Icon size={16} />
        <span>{label}</span>
      </div>
      {badge && badge > 0 && (
        <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}