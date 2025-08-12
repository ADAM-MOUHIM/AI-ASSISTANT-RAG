// src/hooks/withRoleAccess.tsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/context/AuthContext';

interface WithRoleOptions {
  requiredRole?: UserRole;
  Fallback?: React.ComponentType | null;
}

const DefaultFallback = () => (
  <div className="grid place-items-center h-screen">
    <div>Loading…</div>
  </div>
);

export function withRoleAccess<P extends object>(
  Wrapped: React.ComponentType<P>,
  { requiredRole, Fallback = DefaultFallback }: WithRoleOptions = {}
) {
  return function RoleProtected(props: P) {
    const location = useLocation();
    const { isAuthenticated, isInitialized, state, hasRole } = useAuth();

    if (!isInitialized || state.isLoading) {
      return Fallback ? <Fallback /> : null;
    }

    if (!isAuthenticated) {
      return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (requiredRole && !hasRole(requiredRole)) {
      return <Navigate to="/" replace />;
    }

    return <Wrapped {...props} />;
  };
}
