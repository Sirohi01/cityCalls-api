import { connectDb, disconnectDb } from '../src/lib/db';
import { UserModel } from '../src/modules/users/users.model';
import { hashPassword } from '../src/modules/auth/auth.service';
import { RolePermissionModel } from '../src/modules/config/rolePermissions.model';
import { Role } from '../src/modules/users/users.types';

// Bootstrap seed for Phase 1: a Super Admin login + a starter role-permission set
// for the modules built so far (organization, config). Expand this table module-by-module
// as each is implemented, per docs/manish/03-database-model-implementation-plan.md §3 —
// this is not meant to be the full 22-role matrix from docs/05-user-roles-and-permissions.md
// hand-written in one go.
const STARTER_PERMISSIONS: { role: Role; module: string; action: string; dataScope: 'ALL' | 'BRANCH' | 'OWN' }[] = [
  // Super Admin / Admin: full access to everything built so far.
  { role: 'SUPER_ADMIN', module: 'organization', action: 'view', dataScope: 'ALL' },
  { role: 'SUPER_ADMIN', module: 'organization', action: 'create', dataScope: 'ALL' },
  { role: 'SUPER_ADMIN', module: 'organization', action: 'edit', dataScope: 'ALL' },
  { role: 'SUPER_ADMIN', module: 'config', action: 'view', dataScope: 'ALL' },
  { role: 'SUPER_ADMIN', module: 'config', action: 'manageSettings', dataScope: 'ALL' },
  { role: 'ADMIN', module: 'organization', action: 'view', dataScope: 'ALL' },
  { role: 'ADMIN', module: 'organization', action: 'create', dataScope: 'ALL' },
  { role: 'ADMIN', module: 'organization', action: 'edit', dataScope: 'ALL' },
  { role: 'ADMIN', module: 'config', action: 'view', dataScope: 'ALL' },
  { role: 'ADMIN', module: 'config', action: 'manageSettings', dataScope: 'ALL' },
  // Branch Manager: branch-scoped view/edit on organization, read-only on config.
  { role: 'BRANCH_MANAGER', module: 'organization', action: 'view', dataScope: 'BRANCH' },
  { role: 'BRANCH_MANAGER', module: 'organization', action: 'edit', dataScope: 'BRANCH' },
  { role: 'BRANCH_MANAGER', module: 'config', action: 'view', dataScope: 'ALL' },
];

async function seed(): Promise<void> {
  await connectDb();

   
  console.log('[seed] upserting starter role permissions...');
  for (const perm of STARTER_PERMISSIONS) {
    await RolePermissionModel.findOneAndUpdate(
      { role: perm.role, module: perm.module, action: perm.action },
      { dataScope: perm.dataScope },
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
