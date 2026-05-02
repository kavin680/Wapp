export enum Permission {
  // User permissions
  USER_READ = 'user:read',
  USER_CREATE = 'user:create',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',

  // Admin permissions
  ADMIN_ACCESS = 'admin:access',
  ADMIN_MANAGE_USERS = 'admin:manage_users',
  ADMIN_MANAGE_ROLES = 'admin:manage_roles',
  ADMIN_VIEW_AUDIT = 'admin:view_audit',
  ADMIN_MANAGE_SETTINGS = 'admin:manage_settings',

  // Messaging permissions
  MESSAGING_SEND = 'messaging:send',
  MESSAGING_READ = 'messaging:read',
  MESSAGING_MANAGE_PROVIDERS = 'messaging:manage_providers',
  MESSAGING_MANAGE_TEMPLATES = 'messaging:manage_templates',
  MESSAGING_MANAGE_CAMPAIGNS = 'messaging:manage_campaigns',
  MESSAGING_MANAGE_CONTACTS = 'messaging:manage_contacts',
  MESSAGING_VIEW_ANALYTICS = 'messaging:view_analytics',
  MESSAGING_MANAGE_BILLING = 'messaging:manage_billing',
  MESSAGING_MANAGE_API_KEYS = 'messaging:manage_api_keys',
  MESSAGING_MANAGE_SETTINGS = 'messaging:manage_settings',
}
