import { connectDb, disconnectDb } from '../src/lib/db';
import { UserModel } from '../src/modules/users/users.model';
import { hashPassword } from '../src/modules/auth/auth.service';
import { RolePermissionModel } from '../src/modules/config/rolePermissions.model';
import { StatusTransitionModel, EntityType } from '../src/modules/config/statusTransition.model';
import { NotificationTemplateModel, NotificationChannel } from '../src/modules/notifications/notificationTemplates.model';
import { Role, DataScope } from '../src/modules/users/users.types';

// Role-permission seed covering every module built through Phase 1/2, following the
// matrix in docs/05-user-roles-and-permissions.md §4. Expand this table module-by-module
// as each new module is implemented, per docs/manish/03-database-model-implementation-plan.md §3 —
// roles with no row for a given module simply have no access to it, which is correct
// wherever that role has no legitimate business reason to touch that module.
interface PermissionRow {
  role: Role;
  module: string;
  action: string;
  dataScope: DataScope;
}

function allFor(role: Role, modules: string[], actions: string[], dataScope: DataScope): PermissionRow[] {
  const rows: PermissionRow[] = [];
  for (const module of modules) {
    for (const action of actions) {
      rows.push({ role, module, action, dataScope });
    }
  }
  return rows;
}

const ALL_BUILT_MODULES = ['users', 'organization', 'config', 'employees', 'vendors', 'customers', 'catalog', 'calls', 'leads', 'serviceRequests', 'fieldExecution', 'files', 'finance', 'happyCalls', 'marketing', 'ai'];
const CRUD = ['view', 'create', 'edit'];

const PERMISSIONS: PermissionRow[] = [
  // Super Admin / Admin: full access to every module built so far. Per
  // docs/05-user-roles-and-permissions.md §6, these two roles also carry
  // assignment-bypass authority once Service Requests exist (Phase 4).
  ...allFor('SUPER_ADMIN', ALL_BUILT_MODULES, [...CRUD, 'manageSettings', 'viewFinancial', 'assign'], 'ALL'),
  ...allFor('ADMIN', ALL_BUILT_MODULES, [...CRUD, 'manageSettings', 'viewFinancial', 'assign'], 'ALL'),

  // Branch Manager: manages their own branch's org structure, employees, vendors
  // (view only), customers, calls, leads, and service requests (incl. dispatch);
  // can view (not edit) masters/catalog.
  ...allFor('BRANCH_MANAGER', ['organization', 'employees', 'customers', 'calls', 'leads', 'serviceRequests'], CRUD, 'BRANCH'),
  ...allFor('BRANCH_MANAGER', ['serviceRequests'], ['assign'], 'BRANCH'),
  ...allFor('BRANCH_MANAGER', ['config', 'catalog', 'vendors'], ['view'], 'ALL'),
  ...allFor('BRANCH_MANAGER', ['fieldExecution'], ['view'], 'BRANCH'),
  ...allFor('BRANCH_MANAGER', ['files'], ['view', 'create'], 'BRANCH'),
  ...allFor('BRANCH_MANAGER', ['finance'], ['view', 'create', 'edit', 'viewFinancial'], 'BRANCH'),
  ...allFor('BRANCH_MANAGER', ['happyCalls'], ['view', 'edit'], 'BRANCH'),
  ...allFor('BRANCH_MANAGER', ['marketing'], ['view'], 'BRANCH'),
  ...allFor('BRANCH_MANAGER', ['ai'], ['create'], 'BRANCH'),

  // Sub-Branch Admin: same shape as Branch Manager, scoped one level narrower.
  ...allFor('SUB_BRANCH_ADMIN', ['organization', 'employees', 'customers', 'serviceRequests'], CRUD, 'SUB_BRANCH'),
  ...allFor('SUB_BRANCH_ADMIN', ['serviceRequests'], ['assign'], 'SUB_BRANCH'),
  ...allFor('SUB_BRANCH_ADMIN', ['config', 'catalog', 'vendors'], ['view'], 'ALL'),
  ...allFor('SUB_BRANCH_ADMIN', ['fieldExecution'], ['view'], 'SUB_BRANCH'),

  // Team Lead / Employee: view their own team's employee records, view/edit
  // customers and service requests assigned to their team/themselves, and
  // enter field-execution data (inspection/parts/work/completion) for their own jobs.
  ...allFor('TEAM_LEAD', ['employees'], ['view'], 'TEAM'),
  ...allFor('TEAM_LEAD', ['customers', 'serviceRequests'], ['view', 'edit'], 'TEAM'),
  ...allFor('TEAM_LEAD', ['fieldExecution'], ['view'], 'TEAM'),
  ...allFor('EMPLOYEE', ['customers'], ['view'], 'TEAM'),
  ...allFor('EMPLOYEE', ['catalog'], ['view'], 'ALL'),
  ...allFor('EMPLOYEE', ['serviceRequests', 'fieldExecution', 'files'], ['view', 'edit'], 'OWN'),
  ...allFor('EMPLOYEE', ['files'], ['create'], 'OWN'),
  ...allFor('EMPLOYEE', ['finance'], ['view', 'create', 'edit'], 'OWN'), // drafts estimates, records collections on own jobs
  ...allFor('EMPLOYEE', ['happyCalls'], ['view', 'edit'], 'OWN'), // default happy-call performer per happyCallScheduler.ts
  ...allFor('TECHNICIAN', ['serviceRequests', 'fieldExecution', 'files'], ['view', 'edit'], 'OWN'),
  ...allFor('TECHNICIAN', ['files'], ['create'], 'OWN'),
  ...allFor('TECHNICIAN', ['finance'], ['view', 'create', 'edit'], 'OWN'),
  ...allFor('TECHNICIAN', ['happyCalls'], ['view', 'edit'], 'OWN'),
  ...allFor('TECHNICIAN', ['catalog'], ['view'], 'ALL'),

  // Call Executive: creates/edits customers, calls, and service requests (booking
  // on the customer's behalf) within their branch, needs to see the service
  // catalog to log calls/bookings.
  ...allFor('CALL_EXECUTIVE', ['customers', 'calls', 'serviceRequests'], ['view', 'create', 'edit'], 'BRANCH'),
  ...allFor('CALL_EXECUTIVE', ['catalog'], ['view'], 'ALL'),
  ...allFor('CALL_EXECUTIVE', ['files'], ['view', 'create'], 'BRANCH'),
  ...allFor('CALL_EXECUTIVE', ['ai'], ['create'], 'BRANCH'), // call summarization / complaint classification
  ...allFor('HAPPY_CALL_EXECUTIVE', ['calls'], ['view', 'create', 'edit'], 'BRANCH'),
  ...allFor('HAPPY_CALL_EXECUTIVE', ['happyCalls'], ['view', 'edit'], 'BRANCH'),
  ...allFor('CUSTOMER_SUPPORT_EXECUTIVE', ['calls', 'customers', 'serviceRequests'], ['view', 'create', 'edit'], 'BRANCH'),
  ...allFor('CUSTOMER_SUPPORT_EXECUTIVE', ['ai'], ['create'], 'BRANCH'),
  ...allFor('CUSTOMER_SUPPORT_EXECUTIVE', ['happyCalls'], ['view', 'edit'], 'BRANCH'),

  // Sales Executive: owns their own leads and those leads' customers.
  ...allFor('SALES_EXECUTIVE', ['customers', 'leads'], ['view', 'create', 'edit'], 'OWN'),
  ...allFor('SALES_EXECUTIVE', ['catalog'], ['view'], 'ALL'),
  ...allFor('MARKETING_EXECUTIVE', ['leads'], ['view', 'create'], 'ALL'),
  ...allFor('MARKETING_EXECUTIVE', ['marketing'], ['view', 'create', 'edit'], 'ALL'),

  // Finance Executive / Accountant: financial visibility on customers, vendors,
  // and service requests, branch-scoped, plus read access to catalog pricing.
  ...allFor('FINANCE_EXECUTIVE', ['customers', 'vendors', 'serviceRequests'], ['view', 'viewFinancial'], 'BRANCH'),
  ...allFor('FINANCE_EXECUTIVE', ['serviceRequests'], ['edit'], 'BRANCH'), // payment recording
  ...allFor('FINANCE_EXECUTIVE', ['catalog'], ['view'], 'ALL'),
  ...allFor('FINANCE_EXECUTIVE', ['finance'], [...CRUD, 'viewFinancial'], 'BRANCH'),
  ...allFor('ACCOUNTANT', ['customers', 'vendors', 'serviceRequests'], ['view', 'viewFinancial'], 'BRANCH'),
  ...allFor('ACCOUNTANT', ['serviceRequests'], ['edit'], 'BRANCH'),
  ...allFor('ACCOUNTANT', ['finance'], [...CRUD, 'viewFinancial'], 'BRANCH'),

  // Vendor Owner / Manager: manage their own vendor company's profile and
  // technician roster; view/edit the service requests assigned to their vendor,
  // plus reassign within their own team (accept/reject/reassign a technician).
  ...allFor('VENDOR_OWNER', ['vendors'], ['view', 'edit', 'viewFinancial'], 'VENDOR'),
  ...allFor('VENDOR_OWNER', ['customers', 'catalog'], ['view'], 'VENDOR'),
  ...allFor('VENDOR_OWNER', ['serviceRequests', 'fieldExecution'], ['view', 'edit', 'assign'], 'VENDOR'),
  ...allFor('VENDOR_OWNER', ['files'], ['view', 'create'], 'VENDOR'),
  ...allFor('VENDOR_MANAGER', ['vendors'], ['view', 'edit'], 'VENDOR'),
  ...allFor('VENDOR_MANAGER', ['customers', 'catalog'], ['view'], 'VENDOR'),
  ...allFor('VENDOR_MANAGER', ['serviceRequests', 'fieldExecution'], ['view', 'edit', 'assign'], 'VENDOR'),
  ...allFor('VENDOR_MANAGER', ['files'], ['view', 'create'], 'VENDOR'),

  // Vendor Technician / Outsourced Partner: sees and updates only what's assigned to them.
  ...allFor('VENDOR_TECHNICIAN', ['customers', 'catalog'], ['view'], 'OWN'),
  ...allFor('VENDOR_TECHNICIAN', ['serviceRequests', 'fieldExecution', 'files'], ['view', 'edit'], 'OWN'),
  ...allFor('VENDOR_TECHNICIAN', ['files'], ['create'], 'OWN'),
  ...allFor('VENDOR_TECHNICIAN', ['happyCalls'], ['view', 'edit'], 'OWN'),
  ...allFor('OUTSOURCED_PARTNER', ['serviceRequests', 'fieldExecution', 'files'], ['view', 'edit'], 'OWN'),
  ...allFor('OUTSOURCED_PARTNER', ['files'], ['create'], 'OWN'),

  // Marketing/Ops Admin inherit the Admin row narrowed to what they actually need —
  // kept minimal until Marketing/AI modules exist (Phase 8-9).
  ...allFor('OPERATIONS_ADMIN', ALL_BUILT_MODULES, [...CRUD, 'assign'], 'ALL'),

  // Customer: sees their own profile and their own service requests (booking,
  // tracking, cancel/reschedule/approve-estimate/confirm-completion all ride on
  // the same 'edit' + OWN scope — the status engine restricts which specific
  // transitions a CUSTOMER can actually make), and the public catalog.
  ...allFor('CUSTOMER', ['customers'], ['view', 'edit'], 'OWN'),
  ...allFor('CUSTOMER', ['catalog'], ['view'], 'ALL'),
  ...allFor('CUSTOMER', ['serviceRequests'], ['view', 'create', 'edit'], 'OWN'),
  ...allFor('CUSTOMER', ['fieldExecution', 'files'], ['view'], 'OWN'),
  ...allFor('CUSTOMER', ['files'], ['create'], 'OWN'), // issue images at booking time
  ...allFor('CUSTOMER', ['finance'], ['view', 'edit'], 'OWN'), // view + approve/reject own estimates, view own invoices/receipts
  ...allFor('BUSINESS_CUSTOMER', ['customers'], ['view', 'edit'], 'OWN'),
  ...allFor('BUSINESS_CUSTOMER', ['catalog'], ['view'], 'ALL'),
  ...allFor('BUSINESS_CUSTOMER', ['serviceRequests'], ['view', 'create', 'edit'], 'OWN'),
  ...allFor('BUSINESS_CUSTOMER', ['fieldExecution', 'files'], ['view'], 'OWN'),
  ...allFor('BUSINESS_CUSTOMER', ['finance'], ['view', 'edit'], 'OWN'),
  ...allFor('BUSINESS_CUSTOMER', ['files'], ['create'], 'OWN'),
];

// Lead stage transitions per docs/07-status-transition-matrix.md §3. "Owner" in
// that table means the specific user who owns the lead record, not a role — the
// roles listed here are every role that can plausibly own or manage a lead;
// per-record ownership is enforced separately in leads.service.ts changeStage().
// "any -> DUPLICATE" is intentionally NOT seeded here — see the comment on
// mergeLeads() in leads.service.ts for why that transition bypasses this engine.
const LEAD_OWNER_ROLES: Role[] = ['SALES_EXECUTIVE', 'CALL_EXECUTIVE', 'MARKETING_EXECUTIVE', 'BRANCH_MANAGER', 'ADMIN', 'SUPER_ADMIN'];
const LEAD_MANAGER_ROLES: Role[] = ['BRANCH_MANAGER', 'ADMIN', 'SUPER_ADMIN'];

interface TransitionRow {
  entityType: EntityType;
  fromStatus: string;
  toStatus: string;
  allowedRoles: Role[];
}

const STATUS_TRANSITIONS: TransitionRow[] = [
  { entityType: 'LEAD', fromStatus: 'NEW', toStatus: 'CONTACT_ATTEMPTED', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'CONTACT_ATTEMPTED', toStatus: 'CONNECTED', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'CONTACT_ATTEMPTED', toStatus: 'NOT_INTERESTED', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'CONTACT_ATTEMPTED', toStatus: 'INVALID', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'CONNECTED', toStatus: 'REQUIREMENT_COLLECTED', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'REQUIREMENT_COLLECTED', toStatus: 'QUALIFIED', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'REQUIREMENT_COLLECTED', toStatus: 'LOST', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'QUALIFIED', toStatus: 'ESTIMATE_REQUIRED', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'QUALIFIED', toStatus: 'CONVERTED', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'ESTIMATE_REQUIRED', toStatus: 'ESTIMATE_SHARED', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'ESTIMATE_SHARED', toStatus: 'NEGOTIATION', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'ESTIMATE_SHARED', toStatus: 'CONVERTED', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'ESTIMATE_SHARED', toStatus: 'LOST', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'NEGOTIATION', toStatus: 'CONVERTED', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'NEGOTIATION', toStatus: 'LOST', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'NEGOTIATION', toStatus: 'FOLLOW_UP', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'FOLLOW_UP', toStatus: 'CONTACT_ATTEMPTED', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'FOLLOW_UP', toStatus: 'CONNECTED', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'FOLLOW_UP', toStatus: 'REQUIREMENT_COLLECTED', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'FOLLOW_UP', toStatus: 'QUALIFIED', allowedRoles: LEAD_OWNER_ROLES },
  { entityType: 'LEAD', fromStatus: 'FOLLOW_UP', toStatus: 'NEGOTIATION', allowedRoles: LEAD_OWNER_ROLES },
  // Manual reopen of a terminal-lost lead back into active follow-up — manager-only.
  { entityType: 'LEAD', fromStatus: 'LOST', toStatus: 'FOLLOW_UP', allowedRoles: LEAD_MANAGER_ROLES },
  { entityType: 'LEAD', fromStatus: 'NOT_INTERESTED', toStatus: 'FOLLOW_UP', allowedRoles: LEAD_MANAGER_ROLES },
  { entityType: 'LEAD', fromStatus: 'INVALID', toStatus: 'FOLLOW_UP', allowedRoles: LEAD_MANAGER_ROLES },
];

// Service Request status transitions per docs/07-status-transition-matrix.md §2,
// the full 37-status table. Role groups below mirror the "Allowed actor(s)"
// column; where the doc says "the assignee," that's covered by EMPLOYEE/
// TECHNICIAN/VENDOR_* roles (per-record assignment matching is enforced by the
// OWN/VENDOR data scope in the permission layer, not re-checked here).
const ADMIN_BYPASS: Role[] = ['SUPER_ADMIN', 'ADMIN'];
const DISPATCH_DOWN_CHAIN: Role[] = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'SUB_BRANCH_ADMIN'];
const BYPASS_TO_VENDOR: Role[] = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER'];
const ASSIGNEE_ACTION_ROLES: Role[] = ['EMPLOYEE', 'TECHNICIAN', 'VENDOR_OWNER', 'VENDOR_MANAGER', 'VENDOR_TECHNICIAN', 'OUTSOURCED_PARTNER'];
const FIELD_ROLES: Role[] = ['EMPLOYEE', 'TECHNICIAN', 'VENDOR_TECHNICIAN'];
const SCHEDULE_ROLES: Role[] = [...FIELD_ROLES, 'CALL_EXECUTIVE', 'BRANCH_MANAGER'];
const CUSTOMER_ROLES: Role[] = ['CUSTOMER', 'BUSINESS_CUSTOMER'];
const PAYMENT_ROLES: Role[] = [...FIELD_ROLES, 'FINANCE_EXECUTIVE', 'ACCOUNTANT'];
const CLOSE_ROLES: Role[] = ['HAPPY_CALL_EXECUTIVE', 'ADMIN', 'SUPER_ADMIN'];
const FOLLOWUP_ROLES: Role[] = ['CUSTOMER_SUPPORT_EXECUTIVE', 'HAPPY_CALL_EXECUTIVE', 'ADMIN', 'SUPER_ADMIN'];
const ESCALATION_CLOSE_ROLES: Role[] = ['BRANCH_MANAGER', 'ADMIN', 'SUPER_ADMIN'];
const CANCEL_ROLES: Role[] = [...CUSTOMER_ROLES, 'BRANCH_MANAGER', 'ADMIN', 'SUPER_ADMIN'];
const REOPEN_ROLES: Role[] = [...CUSTOMER_ROLES, 'CALL_EXECUTIVE', 'ADMIN', 'SUPER_ADMIN'];

const SERVICE_REQUEST_TRANSITIONS: TransitionRow[] = [
  { entityType: 'SERVICE_REQUEST', fromStatus: 'NEW', toStatus: 'ASSIGNED_TO_BRANCH', allowedRoles: ADMIN_BYPASS },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'NEEDS_MANUAL_BRANCH_ASSIGNMENT', toStatus: 'ASSIGNED_TO_BRANCH', allowedRoles: ADMIN_BYPASS },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'ASSIGNED_TO_BRANCH', toStatus: 'ASSIGNED_TO_SUB_BRANCH', allowedRoles: DISPATCH_DOWN_CHAIN },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'ASSIGNED_TO_SUB_BRANCH', toStatus: 'ASSIGNED_TO_TEAM', allowedRoles: DISPATCH_DOWN_CHAIN },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'ASSIGNED_TO_SUB_BRANCH', toStatus: 'ASSIGNED_TO_EMPLOYEE', allowedRoles: DISPATCH_DOWN_CHAIN },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'ASSIGNED_TO_BRANCH', toStatus: 'ASSIGNED_TO_TEAM', allowedRoles: DISPATCH_DOWN_CHAIN },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'ASSIGNED_TO_BRANCH', toStatus: 'ASSIGNED_TO_EMPLOYEE', allowedRoles: DISPATCH_DOWN_CHAIN },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'ASSIGNED_TO_TEAM', toStatus: 'ASSIGNED_TO_EMPLOYEE', allowedRoles: DISPATCH_DOWN_CHAIN },

  // Accept/reject from every assignable state.
  ...(['ASSIGNED_TO_BRANCH', 'ASSIGNED_TO_SUB_BRANCH', 'ASSIGNED_TO_TEAM', 'ASSIGNED_TO_EMPLOYEE', 'ASSIGNED_TO_VENDOR', 'OUTSOURCED'] as const).flatMap(
    (from) => [
      { entityType: 'SERVICE_REQUEST' as EntityType, fromStatus: from, toStatus: 'ACCEPTED', allowedRoles: ASSIGNEE_ACTION_ROLES },
      { entityType: 'SERVICE_REQUEST' as EntityType, fromStatus: from, toStatus: 'REASSIGNMENT_REQUIRED', allowedRoles: [...ASSIGNEE_ACTION_ROLES, ...ADMIN_BYPASS] },
    ]
  ),
  // Re-dispatch from REASSIGNMENT_REQUIRED back into any assignable state.
  ...(['ASSIGNED_TO_BRANCH', 'ASSIGNED_TO_SUB_BRANCH', 'ASSIGNED_TO_TEAM', 'ASSIGNED_TO_EMPLOYEE', 'ASSIGNED_TO_VENDOR', 'OUTSOURCED'] as const).map(
    (to) => ({ entityType: 'SERVICE_REQUEST' as EntityType, fromStatus: 'REASSIGNMENT_REQUIRED', toStatus: to, allowedRoles: DISPATCH_DOWN_CHAIN })
  ),

  { entityType: 'SERVICE_REQUEST', fromStatus: 'ACCEPTED', toStatus: 'APPOINTMENT_SCHEDULED', allowedRoles: SCHEDULE_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'APPOINTMENT_SCHEDULED', toStatus: 'RESCHEDULED', allowedRoles: [...SCHEDULE_ROLES, ...CUSTOMER_ROLES] },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'APPOINTMENT_SCHEDULED', toStatus: 'TECHNICIAN_EN_ROUTE', allowedRoles: FIELD_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'RESCHEDULED', toStatus: 'TECHNICIAN_EN_ROUTE', allowedRoles: FIELD_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'TECHNICIAN_EN_ROUTE', toStatus: 'TECHNICIAN_ARRIVED', allowedRoles: FIELD_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'TECHNICIAN_ARRIVED', toStatus: 'CUSTOMER_UNAVAILABLE', allowedRoles: FIELD_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'CUSTOMER_UNAVAILABLE', toStatus: 'APPOINTMENT_SCHEDULED', allowedRoles: SCHEDULE_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'CUSTOMER_UNAVAILABLE', toStatus: 'RESCHEDULED', allowedRoles: SCHEDULE_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'TECHNICIAN_ARRIVED', toStatus: 'INSPECTION_STARTED', allowedRoles: FIELD_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'INSPECTION_STARTED', toStatus: 'INSPECTION_COMPLETED', allowedRoles: FIELD_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'INSPECTION_COMPLETED', toStatus: 'ESTIMATE_PENDING', allowedRoles: FIELD_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'INSPECTION_COMPLETED', toStatus: 'WORK_STARTED', allowedRoles: FIELD_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'ESTIMATE_PENDING', toStatus: 'ESTIMATE_SHARED', allowedRoles: [...FIELD_ROLES, 'BRANCH_MANAGER', 'FINANCE_EXECUTIVE'] },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'ESTIMATE_SHARED', toStatus: 'AWAITING_CUSTOMER_APPROVAL', allowedRoles: [...FIELD_ROLES, 'BRANCH_MANAGER', 'FINANCE_EXECUTIVE'] },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'AWAITING_CUSTOMER_APPROVAL', toStatus: 'ESTIMATE_APPROVED', allowedRoles: CUSTOMER_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'AWAITING_CUSTOMER_APPROVAL', toStatus: 'ESTIMATE_REJECTED', allowedRoles: CUSTOMER_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'ESTIMATE_APPROVED', toStatus: 'WORK_STARTED', allowedRoles: FIELD_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'ESTIMATE_REJECTED', toStatus: 'CLOSED', allowedRoles: ESCALATION_CLOSE_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'ESTIMATE_REJECTED', toStatus: 'CANCELLED', allowedRoles: ESCALATION_CLOSE_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'WORK_STARTED', toStatus: 'WORK_IN_PROGRESS', allowedRoles: FIELD_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'WORK_IN_PROGRESS', toStatus: 'PARTS_PENDING', allowedRoles: FIELD_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'WORK_IN_PROGRESS', toStatus: 'ON_HOLD', allowedRoles: FIELD_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'PARTS_PENDING', toStatus: 'WORK_IN_PROGRESS', allowedRoles: FIELD_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'ON_HOLD', toStatus: 'WORK_IN_PROGRESS', allowedRoles: FIELD_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'WORK_IN_PROGRESS', toStatus: 'SERVICE_COMPLETED', allowedRoles: FIELD_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'SERVICE_COMPLETED', toStatus: 'CUSTOMER_CONFIRMATION_PENDING', allowedRoles: FIELD_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'CUSTOMER_CONFIRMATION_PENDING', toStatus: 'PAYMENT_PENDING', allowedRoles: [...CUSTOMER_ROLES, ...FIELD_ROLES] },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'PAYMENT_PENDING', toStatus: 'PARTIALLY_PAID', allowedRoles: PAYMENT_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'PAYMENT_PENDING', toStatus: 'PAID', allowedRoles: PAYMENT_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'PARTIALLY_PAID', toStatus: 'PAID', allowedRoles: ['FINANCE_EXECUTIVE', 'ACCOUNTANT'] },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'PAID', toStatus: 'FOLLOW_UP_PENDING', allowedRoles: FOLLOWUP_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'FOLLOW_UP_PENDING', toStatus: 'HAPPY_CALL_PENDING', allowedRoles: FOLLOWUP_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'HAPPY_CALL_PENDING', toStatus: 'CLOSED', allowedRoles: CLOSE_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'CLOSED', toStatus: 'REOPENED', allowedRoles: REOPEN_ROLES },
  { entityType: 'SERVICE_REQUEST', fromStatus: 'PAID', toStatus: 'REOPENED', allowedRoles: REOPEN_ROLES },
];

// "Any ASSIGNED_TO_* / NEW state -> ASSIGNED_TO_VENDOR / OUTSOURCED (bypass)" —
// generated rather than hand-written per docs/06-complete-workflow-document.md
// Stage 2's "OR request assigned directly to Vendor/Outsource" branch.
const BYPASS_SOURCE_STATUSES = ['NEW', 'NEEDS_MANUAL_BRANCH_ASSIGNMENT', 'ASSIGNED_TO_BRANCH', 'ASSIGNED_TO_SUB_BRANCH', 'ASSIGNED_TO_TEAM', 'ASSIGNED_TO_EMPLOYEE'];
for (const from of BYPASS_SOURCE_STATUSES) {
  SERVICE_REQUEST_TRANSITIONS.push(
    { entityType: 'SERVICE_REQUEST', fromStatus: from, toStatus: 'ASSIGNED_TO_VENDOR', allowedRoles: BYPASS_TO_VENDOR },
    { entityType: 'SERVICE_REQUEST', fromStatus: from, toStatus: 'OUTSOURCED', allowedRoles: BYPASS_TO_VENDOR }
  );
}

// "Any pre-PAID status -> CANCELLED" — docs/07-status-transition-matrix.md §2.
const PRE_PAID_STATUSES = [
  'NEW', 'NEEDS_MANUAL_BRANCH_ASSIGNMENT', 'ASSIGNED_TO_BRANCH', 'ASSIGNED_TO_SUB_BRANCH', 'ASSIGNED_TO_TEAM',
  'ASSIGNED_TO_EMPLOYEE', 'ASSIGNED_TO_VENDOR', 'OUTSOURCED', 'REASSIGNMENT_REQUIRED', 'ACCEPTED',
  'APPOINTMENT_SCHEDULED', 'RESCHEDULED', 'CUSTOMER_UNAVAILABLE', 'TECHNICIAN_EN_ROUTE', 'TECHNICIAN_ARRIVED',
  'INSPECTION_STARTED', 'INSPECTION_COMPLETED', 'ESTIMATE_PENDING', 'ESTIMATE_SHARED', 'AWAITING_CUSTOMER_APPROVAL',
  'ESTIMATE_APPROVED', 'PARTS_PENDING', 'WORK_STARTED', 'WORK_IN_PROGRESS', 'ON_HOLD', 'SERVICE_COMPLETED',
  'CUSTOMER_CONFIRMATION_PENDING', 'PAYMENT_PENDING',
];
for (const from of PRE_PAID_STATUSES) {
  SERVICE_REQUEST_TRANSITIONS.push({ entityType: 'SERVICE_REQUEST', fromStatus: from, toStatus: 'CANCELLED', allowedRoles: CANCEL_ROLES });
}

// Estimate / Proforma Invoice / Invoice status transitions per
// docs/07-status-transition-matrix.md §5. DRAFT is the creation-time status
// (not seeded as a transition, matching how NEW/DRAFT states are handled
// elsewhere — creation bypasses the engine, only explicit changes go through it).
const FINANCE_DOC_ROLES: Role[] = ['EMPLOYEE', 'TECHNICIAN', 'VENDOR_TECHNICIAN', 'BRANCH_MANAGER', 'FINANCE_EXECUTIVE', 'ADMIN', 'SUPER_ADMIN'];
const INVOICE_CANCEL_ROLES: Role[] = ['FINANCE_EXECUTIVE', 'ACCOUNTANT', 'BRANCH_MANAGER', 'ADMIN', 'SUPER_ADMIN'];

const FINANCE_TRANSITIONS: TransitionRow[] = [
  { entityType: 'ESTIMATE', fromStatus: 'DRAFT', toStatus: 'SHARED', allowedRoles: FINANCE_DOC_ROLES },
  { entityType: 'ESTIMATE', fromStatus: 'SHARED', toStatus: 'APPROVED', allowedRoles: CUSTOMER_ROLES },
  { entityType: 'ESTIMATE', fromStatus: 'SHARED', toStatus: 'REJECTED', allowedRoles: CUSTOMER_ROLES },
  { entityType: 'ESTIMATE', fromStatus: 'APPROVED', toStatus: 'CONVERTED', allowedRoles: FINANCE_DOC_ROLES },

  { entityType: 'PROFORMA_INVOICE', fromStatus: 'DRAFT', toStatus: 'SHARED', allowedRoles: FINANCE_DOC_ROLES },
  { entityType: 'PROFORMA_INVOICE', fromStatus: 'SHARED', toStatus: 'ACCEPTED', allowedRoles: CUSTOMER_ROLES },
  { entityType: 'PROFORMA_INVOICE', fromStatus: 'ACCEPTED', toStatus: 'CONVERTED', allowedRoles: FINANCE_DOC_ROLES },

  { entityType: 'INVOICE', fromStatus: 'DRAFT', toStatus: 'CANCELLED', allowedRoles: INVOICE_CANCEL_ROLES },
  { entityType: 'INVOICE', fromStatus: 'ISSUED', toStatus: 'CANCELLED', allowedRoles: INVOICE_CANCEL_ROLES },
];

// Notification template seed — docs/13-notification-and-template-system.md §2's
// trigger catalog, covering the triggerKeys actually fired in code today (see
// lib/notifications.ts callers). Not every one of docs' ~20 documented triggers
// has a seeded template yet (e.g. the dynamic `SERVICE_REQUEST_${toStatus}` key
// covers 37 possible statuses — only the highest-value few are seeded here);
// trigger() itself no-ops safely when no template is registered, so this list
// grows incrementally as each trigger's actual wording is decided by the
// business, not as a blocking prerequisite for the engine to function.
interface TemplateRow {
  triggerKey: string;
  channel: NotificationChannel;
  subjectTemplate?: string;
  bodyTemplate: string;
  variables: string[];
}

const NOTIFICATION_TEMPLATES: TemplateRow[] = [
  { triggerKey: 'SERVICE_REQUEST_CREATED', channel: 'IN_APP', bodyTemplate: 'Your service request {{number}} has been received.', variables: ['number', 'serviceRequestId'] },
  { triggerKey: 'SERVICE_REQUEST_CREATED', channel: 'WHATSAPP', bodyTemplate: 'Hi! Your CityCalls service request {{number}} has been received. We will update you shortly.', variables: ['number'] },
  { triggerKey: 'SERVICE_REQUEST_CREATED', channel: 'EMAIL', subjectTemplate: 'Service Request {{number}} Received', bodyTemplate: '<p>Your service request <strong>{{number}}</strong> has been received and is being reviewed.</p>', variables: ['number'] },

  { triggerKey: 'SERVICE_REQUEST_ASSIGNED', channel: 'IN_APP', bodyTemplate: 'Service request {{serviceRequestId}} has been assigned to you.', variables: ['serviceRequestId'] },

  { triggerKey: 'SERVICE_REQUEST_TECHNICIAN_EN_ROUTE', channel: 'IN_APP', bodyTemplate: 'Your technician is on the way.', variables: [] },
  { triggerKey: 'SERVICE_REQUEST_TECHNICIAN_EN_ROUTE', channel: 'WHATSAPP', bodyTemplate: 'Your CityCalls technician is on the way for {{status}}.', variables: ['status'] },

  { triggerKey: 'SERVICE_REQUEST_SERVICE_COMPLETED', channel: 'IN_APP', bodyTemplate: 'Your service has been marked complete. Please confirm.', variables: [] },

  { triggerKey: 'SERVICE_REQUEST_CLOSED', channel: 'IN_APP', bodyTemplate: 'Your service request has been closed. Thank you!', variables: [] },

  { triggerKey: 'ESTIMATE_SHARED', channel: 'IN_APP', bodyTemplate: 'An estimate for {{total}} has been shared with you. Please review and approve.', variables: ['estimateId', 'number', 'total'] },
  { triggerKey: 'ESTIMATE_SHARED', channel: 'EMAIL', subjectTemplate: 'Estimate {{number}} for Your Approval', bodyTemplate: '<p>An estimate of <strong>₹{{total}}</strong> has been shared for your service request. Please review and approve.</p>', variables: ['number', 'total'] },
  { triggerKey: 'ESTIMATE_SHARED', channel: 'WHATSAPP', bodyTemplate: 'An estimate of Rs.{{total}} has been shared for your CityCalls request. Please check the app to approve.', variables: ['total'] },

  { triggerKey: 'PROFORMA_INVOICE_SHARED', channel: 'IN_APP', bodyTemplate: 'A proforma invoice {{number}} has been shared with you.', variables: ['proformaInvoiceId', 'number'] },

  { triggerKey: 'INVOICE_GENERATED', channel: 'IN_APP', bodyTemplate: 'Invoice {{number}} for ₹{{total}} has been generated.', variables: ['invoiceId', 'number', 'total'] },
  { triggerKey: 'INVOICE_GENERATED', channel: 'EMAIL', subjectTemplate: 'Invoice {{number}}', bodyTemplate: '<p>Your invoice <strong>{{number}}</strong> for ₹{{total}} is attached.</p>', variables: ['number', 'total'] },

  { triggerKey: 'PAYMENT_RECEIVED', channel: 'IN_APP', bodyTemplate: 'Payment of ₹{{amount}} received for receipt {{receiptNumber}}.', variables: ['invoiceId', 'receiptNumber', 'amount'] },
  { triggerKey: 'PAYMENT_RECEIVED', channel: 'WHATSAPP', bodyTemplate: 'We have received your payment of Rs.{{amount}}. Thank you!', variables: ['amount'] },

  { triggerKey: 'COMPLAINT_REOPENED', channel: 'IN_APP', bodyTemplate: 'A service request you handled has been reopened by the customer.', variables: ['originalServiceRequestId', 'newServiceRequestId'] },

  { triggerKey: 'HAPPY_CALL_DUE', channel: 'IN_APP', bodyTemplate: 'A happy call is due for service request {{serviceRequestId}}.', variables: ['serviceRequestId'] },

  { triggerKey: 'HAPPY_CALL_ESCALATION', channel: 'IN_APP', bodyTemplate: 'Customer dissatisfaction flagged on happy call for {{serviceRequestId}}.', variables: ['serviceRequestId', 'remarks'] },

  { triggerKey: 'SLA_BREACHED', channel: 'IN_APP', bodyTemplate: 'SLA breached for service request {{number}}.', variables: ['serviceRequestId', 'number', 'dueAt'] },

  { triggerKey: 'PASSWORD_RESET', channel: 'EMAIL', subjectTemplate: 'Reset Your CityCalls Password', bodyTemplate: '<p>Use this link to reset your password: {{token}}</p>', variables: ['token', 'userId'] },

  { triggerKey: 'OTP_LOGIN', channel: 'WHATSAPP', bodyTemplate: 'Your CityCalls OTP is {{otp}}. Valid for 5 minutes.', variables: ['otp'] },

  { triggerKey: 'SERVICE_COMPLETION_OTP', channel: 'WHATSAPP', bodyTemplate: 'Your CityCalls service completion OTP is {{otp}}. Share this with your technician to confirm completion.', variables: ['otp', 'serviceRequestId'] },
];

async function seed(): Promise<void> {
  await connectDb();

  console.log(`[seed] upserting ${PERMISSIONS.length} role-permission entries...`);
  for (const perm of PERMISSIONS) {
    await RolePermissionModel.findOneAndUpdate(
      { role: perm.role, module: perm.module, action: perm.action },
      { dataScope: perm.dataScope },
      { upsert: true }
    );
  }

  const allTransitions = [...STATUS_TRANSITIONS, ...SERVICE_REQUEST_TRANSITIONS, ...FINANCE_TRANSITIONS];
  console.log(`[seed] upserting ${allTransitions.length} status-transition entries...`);
  for (const t of allTransitions) {
    await StatusTransitionModel.findOneAndUpdate(
      { entityType: t.entityType, fromStatus: t.fromStatus, toStatus: t.toStatus },
      { allowedRoles: t.allowedRoles },
      { upsert: true }
    );
  }

  console.log(`[seed] upserting ${NOTIFICATION_TEMPLATES.length} notification template entries...`);
  for (const t of NOTIFICATION_TEMPLATES) {
    await NotificationTemplateModel.findOneAndUpdate(
      { triggerKey: t.triggerKey, channel: t.channel },
      { subjectTemplate: t.subjectTemplate, bodyTemplate: t.bodyTemplate, variables: t.variables },
      { upsert: true }
    );
  }

  const existingSuperAdmin = await UserModel.findOne({ role: 'SUPER_ADMIN' });
  if (!existingSuperAdmin) {
    const defaultPassword = process.env.SEED_SUPER_ADMIN_PASSWORD;
    if (!defaultPassword) {
      throw new Error(
        'Set SEED_SUPER_ADMIN_PASSWORD in your environment before seeding — no hardcoded default password is used.'
      );
    }
    const passwordHash = await hashPassword(defaultPassword);
    await UserModel.create({
      name: 'Super Admin',
      email: process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@citycalls.local',
      mobile: process.env.SEED_SUPER_ADMIN_MOBILE ?? '9999999999',
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    });
    console.log('[seed] created initial Super Admin user');
  } else {
    console.log('[seed] Super Admin already exists, skipping');
  }

  console.log('[seed] done');
  await disconnectDb();
}

seed().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
