import { useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { UserRole, RolePermissions } from '@/context/AuthContext';

export function useRole() {
  const {
    user,
    isAuthenticated,
    hasRole,
    hasRoleLevel,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
  } = useAuth();

  const currentRole: UserRole | null = user?.role ?? null;

  const permissions = useMemo<RolePermissions>(() => {
    if (!isAuthenticated || !currentRole) {
      return {
        canCreateUsers: false,
        canDeleteUsers: false,
        canUploadDocuments: false,
        canManageSystem: false,
        canAccessAdminPanel: false,
        canViewAllConversations: false,
        canModerateContent: false,
      };
    }

    const keys: (keyof RolePermissions)[] = [
      'canCreateUsers',
      'canDeleteUsers',
      'canUploadDocuments',
      'canManageSystem',
      'canAccessAdminPanel',
      'canViewAllConversations',
      'canModerateContent',
    ];

    const out = {} as RolePermissions;
    for (const k of keys) {
      (out as any)[k] = hasPermission(k);
    }
    return out;
  }, [isAuthenticated, currentRole, hasPermission]);

  const requireRole = useCallback((role: UserRole): boolean => hasRole(role), [hasRole]);
  const requireRoleLevel = useCallback((role: UserRole): boolean => hasRoleLevel(role), [hasRoleLevel]);
  const requirePermission = useCallback(
    (perm: keyof RolePermissions): boolean => hasPermission(perm),
    [hasPermission]
  );

  return {
    user,
    currentRole,
    isAuthenticated,
    isAdmin: hasRole('admin'),
    isModerator: hasRole('moderator'),
    isUser: hasRole('user'),
    permissions,
    hasRole,
    hasRoleLevel,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    requireRole,
    requireRoleLevel,
    requirePermission,
  } as const;
}
