import { useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { UserSidebar } from './UserSidebar';
import { UserProfile } from '@/pages/UserProfile';
import { UserNotifications } from '@/pages/UserNotifications';
import { UserSettings } from '@/pages/UserSettings';
import { UserHelp } from '@/pages/UserHelp';

type UserView = 'profile' | 'settings' | 'notifications' | 'help';

interface UserLayoutProps {
  children?: ReactNode;
}

export function UserLayout({ children }: UserLayoutProps) {
  const [currentView, setCurrentView] = useState<UserView>('profile');
  const { state: { user, isLoading, error } } = useAuth();

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <div className="flex items-center justify-center w-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <div className="flex items-center justify-center w-full">
          <div className="text-center">
            <div className="text-red-500 mb-2">⚠️</div>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    // If children are passed (for nested routes), render them instead
    if (children) {
      return children;
    }

    // Otherwise, render based on current view
    switch (currentView) {
      case 'profile':
        return <UserProfile />;
      case 'notifications':
        return <UserNotifications />;
      case 'settings':
        return <UserSettings />;
      case 'help':
        return <UserHelp />;
      default:
        return <UserProfile />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <UserSidebar 
        currentView={currentView} 
        onViewChange={setCurrentView}
      />
      <main className="flex-1 overflow-auto bg-white dark:bg-gray-800">
        {renderContent()}
      </main>
    </div>
  );
}