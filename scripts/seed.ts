import { connectDb, disconnectDb } from '../src/lib/db';
import { UserModel } from '../src/modules/users/users.model';
import { hashPassword } from '../src/modules/auth/auth.service';
import { RolePermissionModel } from '../src/modules/config/rolePermissions.model';
import { StatusTransitionModel, EntityType } from '../src/modules/config/statusTransition.model';
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

const ALL_BUILT_MODULES = ['users', 'organization', 'config', 'employees', 'vendors', 'customers', 'catalog', 'calls', 'leads'];
const CRUD = ['view', 'create', 'edit'];

const PERMISSIONS: PermissionRow[] = [
  // Super Admin / Admin: full access to every module built so far. Per
  // docs/05-user-roles-and-permissions.md §6, these two roles also carry
  // assignment-bypass authority once Service Requests exist (Phase 4).
  ...allFor('SUPER_ADMIN', ALL_BUILT_MODULES, [...CRUD, 'manageSettings', 'viewFinancial'], 'ALL'),
  ...allFor('ADMIN', ALL_BUILT_MODULES, [...CRUD, 'manageSettings', 'viewFinancial'], 'ALL'),

  // Branch Manager: manages their own branch's org structure, employees, vendors
  // (view only), customers, calls, and leads; can view (not edit) masters/catalog.
  ...allFor('BRANCH_MANAGER', ['organization', 'employees', 'customers', 'calls', 'leads'], CRUD, 'BRANCH'),
  ...allFor('BRANCH_MANAGER', ['config', 'catalog', 'vendors'], ['view'], 'ALL'),

  // Sub-Branch Admin: same shape as Branch Manager, scoped one level narrower.
  ...allFor('SUB_BRANCH_ADMIN', ['organization', 'employees', 'customers'], CRUD, 'SUB_BRANCH'),
  ...allFor('SUB_BRANCH_ADMIN', ['config', 'catalog', 'vendors'], ['view'], 'ALL'),

  // Team Lead / Employee: view their own team's employee records, view/edit
  // customers assigned to their team.
  ...allFor('TEAM_LEAD', ['employees'], ['view'], 'TEAM'),
  ...allFor('TEAM_LEAD', ['customers'], ['view', 'edit'], 'TEAM'),
  ...allFor('EMPLOYEE', ['customers'], ['view'], 'TEAM'),
  ...allFor('EMPLOYEE', ['catalog'], ['view'], 'ALL'),

  // Call Executive: creates/edits customers and calls within their branch, needs
  // to see the service catalog to log calls/bookings.
  ...allFor('CALL_EXECUTIVE', ['customers', 'calls'], ['view', 'create', 'edit'], 'BRANCH'),
  ...allFor('CALL_EXECUTIVE', ['catalog'], ['view'], 'ALL'),
  ...allFor('HAPPY_CALL_EXECUTIVE', ['calls'], ['view', 'create', 'edit'], 'BRANCH'),
  ...allFor('CUSTOMER_SUPPORT_EXECUTIVE', ['calls', 'customers'], ['view', 'create', 'edit'], 'BRANCH'),

  // Sales Executive: owns their own leads and those leads' customers.
  ...allFor('SALES_EXECUTIVE', ['customers', 'leads'], ['view', 'create', 'edit'], 'OWN'),
  ...allFor('SALES_EXECUTIVE', ['catalog'], ['view'], 'ALL'),
  ...allFor('MARKETING_EXECUTIVE', ['leads'], ['view', 'create'], 'ALL'),

  // Finance Executive / Accountant: financial visibility on customers and vendors,
  // branch-scoped, plus read access to catalog pricing.
  ...allFor('FINANCE_EXECUTIVE', ['customers', 'vendors'], ['view', 'viewFinancial'], 'BRANCH'),
  ...allFor('FINANCE_EXECUTIVE', ['catalog'], ['view'], 'ALL'),
  ...allFor('ACCOUNTANT', ['customers', 'vendors'], ['view', 'viewFinancial'], 'BRANCH'),

  // Vendor Owner / Manager: manage their own vendor company's profile and
  // technician roster; view (not edit) the customers/catalog relevant to their jobs.
  ...allFor('VENDOR_OWNER', ['vendors'], ['view', 'edit', 'viewFinancial'], 'VENDOR'),
  ...allFor('VENDOR_OWNER', ['customers', 'catalog'], ['view'], 'VENDOR'),
  ...allFor('VENDOR_MANAGER', ['vendors'], ['view', 'edit'], 'VENDOR'),
  ...allFor('VENDOR_MANAGER', ['customers', 'catalog'], ['view'], 'VENDOR'),

  // Vendor Technician: sees only what's assigned to them.
  ...allFor('VENDOR_TECHNICIAN', ['customers', 'catalog'], ['view'], 'OWN'),

  // Marketing/Ops Admin inherit the Admin row narrowed to what they actually need —
  // kept minimal until Marketing/AI modules exist (Phase 8-9).
  ...allFor('OPERATIONS_ADMIN', ALL_BUILT_MODULES, CRUD, 'ALL'),

  // Customer: sees their own profile only, and the public catalog.
  ...allFor('CUSTOMER', ['customers'], ['view', 'edit'], 'OWN'),
  ...allFor('CUSTOMER', ['catalog'], ['view'], 'ALL'),
  ...allFor('BUSINESS_CUSTOMER', ['customers'], ['view', 'edit'], 'OWN'),
  ...allFor('BUSINESS_CUSTOMER', ['catalog'], ['view'], 'ALL'),
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

  console.log(`[seed] upserting ${STATUS_TRANSITIONS.length} status-transition entries...`);
  for (const t of STATUS_TRANSITIONS) {
    await StatusTransitionModel.findOneAndUpdate(
      { entityType: t.entityType, fromStatus: t.fromStatus, toStatus: t.toStatus },
      { allowedRoles: t.allowedRoles },
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
