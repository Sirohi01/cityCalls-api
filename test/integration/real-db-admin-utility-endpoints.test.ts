import { connectTestDb, disconnectTestDb } from '../setup/testDb';
import { UserModel } from '../../src/modules/users/users.model';
import { MasterModel } from '../../src/modules/config/master.model';
import { RolePermissionModel } from '../../src/modules/config/rolePermissions.model';
import { CustomerModel } from '../../src/modules/customers/customers.model';
import { ServiceModel } from '../../src/modules/catalog/catalog.model';
import { ServiceRequestModel } from '../../src/modules/service-requests/serviceRequests.model';
import { ReopenRecordModel } from '../../src/modules/follow-up/reopenRecords.model';
import { listBrands } from '../../src/modules/catalog/catalog.service';
import { listRoles } from '../../src/modules/users/users.service';
import { listAllReopenRequests } from '../../src/modules/follow-up/happyCalls.service';
import { listAuditLogs } from '../../src/modules/audit/audit.service';
import { logActivity } from '../../src/lib/auditLog';
import { AccessTokenPayload } from '../../src/lib/jwt';

// Regression coverage for the four endpoints (brands, roles, reopen-requests,
// audit logs) that a third-party commit added as hardcoded mock data instead
// of real queries — one of which (audit logs) crashed with a 500 the moment
// a real ActivityLog document existed, because it populated a field name
// ('actor') that doesn't exist on the schema (the real field is 'userId').
// These tests exist specifically to prove the replacement implementations
// are backed by real data and don't regress the same way.
describe('Admin utility endpoints — brands, roles, reopen-requests, audit logs (real in-memory MongoDB)', () => {
  jest.setTimeout(60_000);
  let actor: AccessTokenPayload;

  beforeAll(async () => {
    await connectTestDb();
    const user = await UserModel.create({
      name: 'Admin',
      email: 'admin6@test.local',
      mobile: '9222222222',
      passwordHash: 'x',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    });
    actor = { sub: user._id.toString(), role: 'SUPER_ADMIN' };
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('listBrands returns real Master(BRAND) documents, not hardcoded data', async () => {
    await MasterModel.create([
      { masterType: 'BRAND', key: 'LG', label: 'LG', active: true },
      { masterType: 'BRAND', key: 'SAMSUNG', label: 'Samsung', active: false },
      { masterType: 'PRODUCT_TYPE', key: 'AC', label: 'AC' }, // must not leak into brands
    ]);

    const brands = await listBrands();
    expect(brands).toHaveLength(2);
    expect(brands.find((b) => b.key === 'LG')?.status).toBe('Active');
    expect(brands.find((b) => b.key === 'SAMSUNG')?.status).toBe('Inactive');
  });

  it('listRoles returns the real ROLES enum with permissions aggregated from RolePermissionModel', async () => {
    await RolePermissionModel.create({ role: 'CALL_EXECUTIVE', module: 'calls', action: 'view', dataScope: 'BRANCH' });
    await RolePermissionModel.create({ role: 'CALL_EXECUTIVE', module: 'calls', action: 'create', dataScope: 'BRANCH' });

    const roles = await listRoles();
    const callExecutive = roles.find((r) => r.id === 'CALL_EXECUTIVE');
    expect(callExecutive?.permissions).toEqual(expect.arrayContaining(['calls.view', 'calls.create']));
    expect(callExecutive?.name).toBe('Call Executive');

    // Every real role from the enum must be present, not a hardcoded subset of 3.
    expect(roles.length).toBeGreaterThan(15);
  });

  it('listAllReopenRequests resolves the real customer name and service request number via the actual chain', async () => {
    const category = await MasterModel.create({ masterType: 'SERVICE_CATEGORY', key: 'AC', label: 'AC Repair' });
    const service = await ServiceModel.create({ name: 'AC Repair', categoryId: category._id, active: true });
    const customer = await CustomerModel.create({
      customerType: 'INDIVIDUAL',
      name: 'Reopen Test Customer',
      contacts: [{ name: 'Reopen Test Customer', mobile: '9000000099', isPrimary: true }],
      addresses: [{ line1: 'Flat 1', city: 'Delhi', state: 'Delhi', pinCode: '110001', country: 'India', isDefault: true }],
    });
    const original = await ServiceRequestModel.create({
      number: 'SR-REOPEN-TEST-0001',
      customerId: customer._id,
      addressSnapshot: { line1: 'Flat 1', city: 'Delhi', state: 'Delhi', pinCode: '110001', country: 'India' },
      serviceId: service._id,
      status: 'REOPENED',
      source: 'CALL',
      createdBy: actor.sub,
    });
    const newSr = await ServiceRequestModel.create({
      number: 'SR-REOPEN-TEST-0002',
      customerId: customer._id,
      addressSnapshot: { line1: 'Flat 1', city: 'Delhi', state: 'Delhi', pinCode: '110001', country: 'India' },
      serviceId: service._id,
      status: 'NEW',
      source: 'CALL',
      createdBy: actor.sub,
      isReopen: true,
      originalServiceRequestId: original._id,
    });
    await ReopenRecordModel.create({
      originalServiceRequestId: original._id,
      newServiceRequestId: newSr._id,
      reason: 'AC not cooling again',
      reopenedBy: actor.sub,
      withinPolicyWindow: true,
      reopenCount: 1,
    });

    const { items } = await listAllReopenRequests({ page: 1, limit: 20 });
    const found = items.find((r) => r.requestNumber === 'SR-REOPEN-TEST-0001');
    expect(found?.customerName).toBe('Reopen Test Customer');
    expect(found?.reason).toBe('AC not cooling again');
    expect(found?.status).toBe('COMPLETED');
  });

  it('listAuditLogs resolves the real user name via userId and does not crash on real data (the exact bug that shipped)', async () => {
    await logActivity({
      entityType: 'CUSTOMER',
      entityId: actor.sub,
      user: actor,
      action: 'UPDATE',
      module: 'customers',
      reason: 'test',
    });

    const { items } = await listAuditLogs({ page: 1, limit: 20 });
    expect(items.length).toBeGreaterThanOrEqual(1);
    const entry = items[0];
    expect(entry.user).toBe('Admin'); // resolved from the real User document, not a made-up 'actor' field
    expect(entry.module).toBe('customers');
  });

  it('listAuditLogs handles a system-initiated entry (no userId) without crashing', async () => {
    await ActivityLogModelSafeInsert();
    const { items } = await listAuditLogs({ page: 1, limit: 50 });
    const systemEntry = items.find((i) => i.user === 'System');
    expect(systemEntry).toBeDefined();
  });
});

// Mirrors how happyCallScheduler.ts writes a system-initiated log — no userId,
// userRole: 'SYSTEM' — imported lazily here to avoid pulling in the whole
// scheduler module just for its audit-log shape.
async function ActivityLogModelSafeInsert() {
  const { ActivityLogModel } = await import('../../src/modules/audit/activityLog.model');
  await ActivityLogModel.create({
    entityType: 'SERVICE_REQUEST',
    entityId: '6a0000000000000000000099',
    userRole: 'SYSTEM',
    action: 'AUTO_PROGRESS',
    module: 'happyCalls',
  });
}
