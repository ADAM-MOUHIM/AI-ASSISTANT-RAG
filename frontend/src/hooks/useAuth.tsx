// hooks/useAuth.ts
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth as useAuthContext } from '@/context/AuthContext';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password'];

// Routes that require admin access
const ADMIN_ROUTES = ['/admin', '/admin/dashboard', '/admin/users', '/admin/documents'];

export function useAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuthContext();

  // Check if auth is still loading/initializing
  const isInitialized = auth.token !== undefined; // Token will be null (not authenticated) or string (authenticated)

  // Redirect logic
  useEffect(() => {
    // Don't do anything while auth is still initializing
    if (!isInitialized) return;

    const currentPath = location.pathname;
    const isPublicRoute = PUBLIC_ROUTES.some(route => currentPath.startsWith(route));
    const isAdminRoute = ADMIN_ROUTES.some(route => currentPath.startsWith(route));

    // If not authenticated and trying to access protected route
    if (!auth.isAuthenticated && !isPublicRoute) {
      navigate('/login', {
        replace: true,
        state: { from: currentPath } // Store where they were trying to go
      });
      return;
    }

    // If authenticated and on public route, redirect to appropriate dashboard
    if (auth.isAuthenticated && isPublicRoute) {
      const from = location.state?.from || (auth.isAdmin ? '/admin/dashboard' : '/dashboard');
      navigate(from, { replace: true });
      return;
    }

    // If trying to access admin route without admin role
    if (isAdminRoute && !auth.isAdmin) {
      navigate('/dashboard', { replace: true });
      return;
    }

  }, [
    auth.isAuthenticated,
    auth.isAdmin,
    isInitialized,
    location.pathname,
    location.state?.from,
    navigate
  ]);

  return {
    ...auth,
    isInitialized
  };
}

// Hook for protecting components
export function useRequireAuth(requiredRole?: 'admin') {
  const auth = useAuthContext();
  const isInitialized = auth.token !== undefined;

  if (!isInitialized) {
    return {
      isAuthorized: false,
      isLoading: true,
      error: null
    };
  }

  if (!auth.isAuthenticated) {
    return {
      isAuthorized: false,
      isLoading: auth.state.isLoading,
      error: 'Authentication required'
    };
  }

  if (requiredRole === 'admin' && !auth.isAdmin) {
    return {
      isAuthorized: false,
      isLoading: false,
      error: 'Admin access required'
    };
  }

  return {
    isAuthorized: true,
    isLoading: auth.state.isLoading,
    error: null
  };
}

// Component wrapper for route protection
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin';
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ 
  children, 
  requiredRole, 
  fallback = null 
}: ProtectedRouteProps) {
  const { isAuthorized, isLoading, error } = useRequireAuth(requiredRole);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthorized) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// HOC for protecting components
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  requiredRole?: 'admin'
) {
  return function AuthenticatedComponent(props: P) {
    return (
      <ProtectedRoute requiredRole={requiredRole}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}