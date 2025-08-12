export type UserRole = "admin" | "user";

export interface RolePermissions {
  canCreateUsers: boolean;
  canDeleteUsers: boolean;
  canUploadDocuments: boolean;
  canManageSystem: boolean;
  canAccessAdminPanel: boolean;
  canViewAllConversations: boolean;
}
