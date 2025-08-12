// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { ChatProvider } from '@/context/ChatContext';

import { AppLayout } from '@/components/layout/AppLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';

import { HomePage } from '@/pages/HomePage';
import { ChatPage } from '@/pages/ChatPage';
import { UserProfile } from '@/pages/UserProfile';
import { UserSettings } from '@/pages/UserSettings';
import { UserHelp } from '@/pages/UserHelp';
import { UserNotifications } from '@/pages/UserNotifications';
import { DashboardPage } from '@/pages/DashboardPage';
import { ManageUsers } from '@/pages/ManageUsers';
import { CreateUser } from '@/pages/CreateUser';
import { UploadDocs } from './pages/UploadDoc';
import Login from '@/pages/Login';

import { withRoleAccess } from '@/hooks/withRoleAccess';

const AdminDashboard = withRoleAccess(DashboardPage, { requiredRole: 'admin' });
const AdminUsers     = withRoleAccess(ManageUsers,   { requiredRole: 'admin' });
const AdminUserNew   = withRoleAccess(CreateUser,    { requiredRole: 'admin' });
const AdminUpload = withRoleAccess(UploadDocs,    { requiredRole: 'admin' });

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* ADMIN (no ChatProvider here) */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="upload" element={<AdminUpload />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/new" element={<AdminUserNew />} />
              <Route path="settings" element={<div className="text-white">System Settings (WIP)</div>} />
            </Route>

            {/* MAIN APP — ChatProvider only for this branch */}
            <Route
              path="/"
              element={
                <ChatProvider>
                  <AppLayout />
                </ChatProvider>
              }
            >
              <Route index element={<HomePage />} />
              <Route path="chats/:chatId" element={<ChatPage />} />
              <Route path="profile" element={<UserProfile />} />
              <Route path="settings" element={<UserSettings />} />
              <Route path="help" element={<UserHelp />} />
              <Route path="notifications" element={<UserNotifications />} />
            </Route>

            {/* AUTH (no ChatProvider) */}
            <Route path="/login" element={<Login />} />

            {/* FALLBACK */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
