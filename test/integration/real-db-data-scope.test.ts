import { connectTestDb, disconnectTestDb, clearTestDb } from '../setup/testDb';
import { BranchModel } from '../../src/modules/organization/organization.model';
import { listBranches, listSubBranches, listTeams } from '../../src/modules/organization/organization.service';
import { LeadModel } from '../../src/modules/leads/leads.model';
import { listLeads } from '../../src/modules/leads/leads.service';
import { CallModel } from '../../src/modules/calls/calls.model';
import { listCalls } from '../../src/modules/calls/calls.service';
import { EmployeeModel } from '../../src/modules/employees/employees.model';
import { listEmployees } from '../../src/modules/employees/employees.service';
import { ServiceRequestModel } from '../../src/modules/service-requests/serviceRequests.model';
import { listServiceRequests } from '../../src/modules/service-requests/serviceRequests.service';
import { UserModel } from '../../src/modules/users/users.model';
import { AccessTokenPayload } from '../../src/lib/jwt';

// applyScopeFilter (src/lib/scopeFilter.ts) was defined but never wired into
// any list endpoint — every BRANCH/SUB_BRANCH/OWN-scoped role could list
// every other branch/owner's records regardless of their granted dataScope.
// These tests prove the fix: a scoped caller only sees their own slice, and
// an ALL-scoped caller (e.g. Super Admin) still sees everything.
describe('Data-scope enforcement on list endpoints (real in-memory MongoDB)', () => {
  jest.setTimeout(60_000);

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  it('listLeads: OWN scope only returns the caller\'s own leads; ALL scope returns everyone\'s', async () => {
    const owner = await UserModel.create({ name: 'Sales A', mobile: '9000000001', passwordHash: 'x', role: 'SALES_EXECUTIVE', status: 'ACTIVE' });
    const otherOwner = await UserModel.create({ name: 'Sales B', mobile: '9000000002', passwordHash: 'x', role: 'SALES_EXECUTIVE', status: 'ACTIVE' });
    await LeadModel.create({ number: 'LEAD-0001', ownerId: owner._id, source: 'CALL', stage: 'NEW' });
    await LeadModel.create({ number: 'LEAD-0002', ownerId: otherOwner._id, source: 'CALL', stage: 'NEW' });

    const ownScopedUser: AccessTokenPayload = { sub: owner._id.toString(), role: 'SALES_EXECUTIVE' };
    const { items: ownItems } = await listLeads({ page: 1, limit: 20 }, 'OWN', ownScopedUser);
    expect(ownItems).toHaveLength(1);
    expect(ownItems[0].number).toBe('LEAD-0001');

    const { items: allItems } = await listLeads({ page: 1, limit: 20 }, 'ALL', ownScopedUser);
    expect(allItems).toHaveLength(2);
  });

  it('listCalls: BRANCH scope only returns the caller\'s own branch\'s calls', async () => {
    const branchA = await BranchModel.create({ name: 'Branch A', code: 'BRA' });
    const branchB = await BranchModel.create({ name: 'Branch B', code: 'BRB' });
    const user = await UserModel.create({ name: 'Call Exec', mobile: '9000000003', passwordHash: 'x', role: 'CALL_EXECUTIVE', status: 'ACTIVE', branchId: branchA._id });
    await CallModel.create({ number: 'CALL-0001', callType: 'INITIAL', direction: 'INCOMING', callerNumber: '9111111111', callDate: new Date(), callTime: '10:00', branchId: branchA._id, createdBy: user._id });
    await CallModel.create({ number: 'CALL-0002', callType: 'INITIAL', direction: 'INCOMING', callerNumber: '9222222222', callDate: new Date(), callTime: '10:00', branchId: branchB._id, createdBy: user._id });

    const branchScopedUser: AccessTokenPayload = { sub: user._id.toString(), role: 'CALL_EXECUTIVE', branchId: branchA._id.toString() };
    const { items } = await listCalls({ page: 1, limit: 20 }, 'BRANCH', branchScopedUser);
    expect(items).toHaveLength(1);
    expect(items[0].number).toBe('CALL-0001');
  });

  it('listEmployees: BRANCH scope excludes another branch\'s employees even if the caller passes that branchId explicitly', async () => {
    const branchA = await BranchModel.create({ name: 'Branch A', code: 'EBA' });
    const branchB = await BranchModel.create({ name: 'Branch B', code: 'EBB' });
    const userA = await UserModel.create({ name: 'Emp A', mobile: '9000000004', passwordHash: 'x', role: 'EMPLOYEE', status: 'ACTIVE' });
    const userB = await UserModel.create({ name: 'Emp B', mobile: '9000000005', passwordHash: 'x', role: 'EMPLOYEE', status: 'ACTIVE' });
    await EmployeeModel.create({ userId: userA._id, branchId: branchA._id, designation: 'Technician' });
    await EmployeeModel.create({ userId: userB._id, branchId: branchB._id, designation: 'Technician' });

    const manager: AccessTokenPayload = { sub: userA._id.toString(), role: 'BRANCH_MANAGER', branchId: branchA._id.toString() };
    // Explicitly try to widen the view to branch B via the query param — must be ignored.
    const { items } = await listEmployees({ page: 1, limit: 20, branchId: branchB._id.toString() }, 'BRANCH', manager);
    expect(items).toHaveLength(1);
    expect(items[0].branchId.toString()).toBe(branchA._id.toString());
  });

  it('listServiceRequests: BRANCH scope only returns the caller\'s own branch\'s service requests', async () => {
    const branchA = await BranchModel.create({ name: 'Branch A', code: 'SBA' });
    const branchB = await BranchModel.create({ name: 'Branch B', code: 'SBB' });
    const user = await UserModel.create({ name: 'BM', mobile: '9000000006', passwordHash: 'x', role: 'BRANCH_MANAGER', status: 'ACTIVE', branchId: branchA._id });
    await ServiceRequestModel.create({
      number: 'SR-SCOPE-0001', customerId: user._id, addressSnapshot: { line1: 'x', city: 'x', state: 'x', pinCode: '110001', country: 'India' },
      serviceId: user._id, status: 'NEW', source: 'CALL', createdBy: user._id, branchId: branchA._id,
    });
    await ServiceRequestModel.create({
      number: 'SR-SCOPE-0002', customerId: user._id, addressSnapshot: { line1: 'x', city: 'x', state: 'x', pinCode: '110001', country: 'India' },
      serviceId: user._id, status: 'NEW', source: 'CALL', createdBy: user._id, branchId: branchB._id,
    });

    const branchScopedUser: AccessTokenPayload = { sub: user._id.toString(), role: 'BRANCH_MANAGER', branchId: branchA._id.toString() };
    const { items } = await listServiceRequests({ page: 1, limit: 20 }, 'BRANCH', branchScopedUser);
    expect(items).toHaveLength(1);
    expect(items[0].number).toBe('SR-SCOPE-0001');
  });

  it('listBranches/listSubBranches/listTeams: BRANCH scope restricts a Branch Manager to their own branch tree', async () => {
    const branchA = await BranchModel.create({ name: 'Branch A', code: 'OBA' });
    const branchB = await BranchModel.create({ name: 'Branch B', code: 'OBB' });
    const { SubBranchModel, TeamModel } = await import('../../src/modules/organization/organization.model');
    await SubBranchModel.create({ branchId: branchA._id, name: 'Sub A1', code: 'SA1' });
    await SubBranchModel.create({ branchId: branchB._id, name: 'Sub B1', code: 'SB1' });
    await TeamModel.create({ branchId: branchA._id, name: 'Team A1' });
    await TeamModel.create({ branchId: branchB._id, name: 'Team B1' });

    const manager: AccessTokenPayload = { sub: 'x', role: 'BRANCH_MANAGER', branchId: branchA._id.toString() };

    const { items: branches } = await listBranches({ page: 1, limit: 20 }, 'BRANCH', manager);
    expect(branches).toHaveLength(1);
    expect(branches[0].code).toBe('OBA');

    // Attempt to widen via query param to branch B's sub-branches — ignored under BRANCH scope.
    const { items: subBranches } = await listSubBranches(branchB._id.toString(), { page: 1, limit: 20 }, 'BRANCH', manager);
    expect(subBranches).toHaveLength(1);
    expect(subBranches[0].code).toBe('SA1');

    const { items: teams } = await listTeams(undefined, { page: 1, limit: 20 }, 'BRANCH', manager);
    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe('Team A1');
  });

  it('ALL scope (Super Admin) still sees every branch\'s data unfiltered', async () => {
    const branchA = await BranchModel.create({ name: 'Branch A', code: 'AAA' });
    const branchB = await BranchModel.create({ name: 'Branch B', code: 'AAB' });
    const admin = await UserModel.create({ name: 'Super', mobile: '9000000007', passwordHash: 'x', role: 'SUPER_ADMIN', status: 'ACTIVE' });
    await CallModel.create({ number: 'CALL-ALL-0001', callType: 'INITIAL', direction: 'INCOMING', callerNumber: '9333333333', callDate: new Date(), callTime: '10:00', branchId: branchA._id, createdBy: admin._id });
    await CallModel.create({ number: 'CALL-ALL-0002', callType: 'INITIAL', direction: 'INCOMING', callerNumber: '9444444444', callDate: new Date(), callTime: '10:00', branchId: branchB._id, createdBy: admin._id });

    const adminUser: AccessTokenPayload = { sub: admin._id.toString(), role: 'SUPER_ADMIN' };
    const { items } = await listCalls({ page: 1, limit: 20 }, 'ALL', adminUser);
    expect(items).toHaveLength(2);
  });
});
