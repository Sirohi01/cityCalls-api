// Canonical role list — must match docs/coordination/06-naming-conventions.md §4
// and docs/05-user-roles-and-permissions.md §1 exactly.
export const ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'OPERATIONS_ADMIN',
  'BRANCH_ADMIN',
  'SUB_BRANCH_ADMIN',
  'BRANCH_MANAGER',
  'TEAM_LEAD',
  'EMPLOYEE',
  'TECHNICIAN',
  'CALL_EXECUTIVE',
  'CUSTOMER_SUPPORT_EXECUTIVE',
  'HAPPY_CALL_EXECUTIVE',
  'SALES_EXECUTIVE',
  'MARKETING_EXECUTIVE',
  'FINANCE_EXECUTIVE',
  'ACCOUNTANT',
  'VENDOR_OWNER',
  'VENDOR_MANAGER',
  'VENDOR_TECHNICIAN',
  'OUTSOURCED_PARTNER',
  'CUSTOMER',
  'BUSINESS_CUSTOMER',
] as const;

export type Role = (typeof ROLES)[number];

// Data-scope levels — docs/05-user-roles-and-permissions.md §2
export const DATA_SCOPES = ['OWN', 'TEAM', 'SUB_BRANCH', 'BRANCH', 'VENDOR', 'ALL'] as const;
export type DataScope = (typeof DATA_SCOPES)[number];

export const USER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
