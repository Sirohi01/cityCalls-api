import { connectTestDb, disconnectTestDb } from '../setup/testDb';
import { UserModel } from '../../src/modules/users/users.model';
import { CustomerModel } from '../../src/modules/customers/customers.model';
import { LeadModel } from '../../src/modules/leads/leads.model';
import { ServiceRequestModel } from '../../src/modules/service-requests/serviceRequests.model';
import { InvoiceModel } from '../../src/modules/finance/invoices.model';
import { ServiceModel } from '../../src/modules/catalog/catalog.model';
import { MasterModel } from '../../src/modules/config/master.model';
import { BranchModel } from '../../src/modules/organization/organization.model';
import { runReport } from '../../src/modules/reports/reports.service';
import { exportEntity } from '../../src/modules/import-export/export.service';
import { importEntity } from '../../src/modules/import-export/import.service';
import { ValidationError, NotFoundError } from '../../src/lib/errors';
import { AccessTokenPayload } from '../../src/lib/jwt';

// Real (in-memory) DB coverage for Phase 10 — reports run real aggregation
// pipelines against real documents (not mocked), export produces a real CSV
// from real documents, and import round-trips a CSV through Zod validation
// and actual document creation. Matches the pattern established in Phases
// 6-9: at least one flow per phase gets exercised against real Mongoose
// behavior, not just mocks.
describe('Reports + Export + Import (real in-memory MongoDB)', () => {
  jest.setTimeout(60_000);
  let actor: AccessTokenPayload;
  let branchId: string;
  let customerId: string;

  beforeAll(async () => {
    await connectTestDb();

    const user = await UserModel.create({
      name: 'Admin',
      email: 'admin5@test.local',
      mobile: '9555555555',
      passwordHash: 'x',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    });
    actor = { sub: user._id.toString(), role: 'SUPER_ADMIN' };

    const branch = await BranchModel.create({ name: 'Delhi Central', code: 'DEL01' });
    branchId = branch._id.toString();

    const category = await MasterModel.create({ masterType: 'SERVICE_CATEGORY', key: 'AC', label: 'AC Repair' });
    const service = await ServiceModel.create({ name: 'AC Repair', categoryId: category._id, active: true });

    const customer = await CustomerModel.create({
      customerType: 'INDIVIDUAL',
      name: 'Report Customer',
      contacts: [{ name: 'Report Customer', mobile: '9000000002', isPrimary: true }],
      addresses: [{ line1: 'Flat 3', city: 'Delhi', state: 'Delhi', pinCode: '110003', country: 'India', isDefault: true }],
    });
    customerId = customer._id.toString();

    await ServiceRequestModel.create([
      {
        number: 'SR-RPT-0001',
        customerId,
        branchId,
        addressSnapshot: { line1: 'Flat 3', city: 'Delhi', state: 'Delhi', pinCode: '110003', country: 'India' },
        serviceId: service._id,
        status: 'CLOSED',
        source: 'CALL',
        createdBy: user._id,
        completedAt: new Date(),
      },
      {
        number: 'SR-RPT-0002',
        customerId,
        branchId,
        addressSnapshot: { line1: 'Flat 3', city: 'Delhi', state: 'Delhi', pinCode: '110003', country: 'India' },
        serviceId: service._id,
        status: 'NEW',
        source: 'CALL',
        createdBy: user._id,
      },
    ]);

    await LeadModel.create([
      { number: 'LEAD-RPT-0001', stage: 'NEW', source: 'WEBSITE', ownerId: user._id, branchId },
      { number: 'LEAD-RPT-0002', stage: 'CONVERTED', source: 'WEBSITE', ownerId: user._id, branchId },
    ]);

    await InvoiceModel.create({
      number: 'INV-RPT-0001',
      customerId,
      branchId,
      financialYear: '2025-26',
      items: [],
      subtotal: 1000,
      total: 1000,
      amountPaid: 400,
      status: 'PARTIALLY_PAID',
    });
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('reports.service', () => {
    it('service-request-summary groups by status and reports SLA/escalation totals', async () => {
      const result = (await runReport('service-request-summary', 'ALL', actor, {})) as {
        byStatus: { status: string; count: number }[];
        totals: { total: number };
      };
      const closed = result.byStatus.find((r) => r.status === 'CLOSED');
      expect(closed?.count).toBeGreaterThanOrEqual(1);
      expect(result.totals.total).toBeGreaterThanOrEqual(2);
    });

    it('branch-performance reports completion rate and revenue per branch', async () => {
      const result = (await runReport('branch-performance', 'ALL', actor, {})) as {
        branchId: unknown;
        totalServiceRequests: number;
        closed: number;
        revenue: number;
      }[];
      const row = result.find((r) => String(r.branchId) === branchId);
      expect(row?.totalServiceRequests).toBe(2);
      expect(row?.closed).toBe(1);
      expect(row?.revenue).toBe(1000);
    });

    it('lead-funnel groups by stage and computes conversion rate', async () => {
      const result = (await runReport('lead-funnel', 'ALL', actor, {})) as { total: number; conversionRate: number };
      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.conversionRate).toBeGreaterThan(0);
    });

    it('revenue-summary computes outstanding as invoiced minus collected', async () => {
      const result = (await runReport('revenue-summary', 'ALL', actor, {})) as { invoiced: number; collected: number; outstanding: number };
      expect(result.invoiced).toBeGreaterThanOrEqual(1000);
      expect(result.outstanding).toBe(result.invoiced - result.collected);
    });

    it('a BRANCH-scoped caller is pinned to their own branch regardless of query params', async () => {
      const branchUser: AccessTokenPayload = { sub: actor.sub, role: 'BRANCH_MANAGER', branchId };
      const result = (await runReport('branch-performance', 'BRANCH', branchUser, { branchId: 'someOtherBranchId' })) as {
        branchId: unknown;
      }[];
      expect(result.every((r) => String(r.branchId) === branchId)).toBe(true);
    });

    it('throws a validation error for an unknown report key', async () => {
      await expect(runReport('not-a-real-report', 'ALL', actor, {})).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('export.service', () => {
    it('exports leads as CSV with the default column set', async () => {
      const result = await exportEntity('leads', 'csv', 'ALL', actor, {});
      const text = result.body as string;
      expect(result.filename).toMatch(/^leads_\d{4}-\d{2}-\d{2}\.csv$/);
      expect(text.split('\r\n')[0]).toBe('_id,number,stage,source,priority,score,ownerId,contactName,contactMobile,branchId,createdAt');
      expect(text).toContain('LEAD-RPT-0001');
    });

    it('exports invoices as XLSX (binary buffer)', async () => {
      const result = await exportEntity('invoices', 'xlsx', 'ALL', actor, {});
      expect(Buffer.isBuffer(result.body)).toBe(true);
      expect((result.body as Buffer).length).toBeGreaterThan(0);
    });

    it('rejects an unsupported column name', async () => {
      await expect(exportEntity('leads', 'csv', 'ALL', actor, {}, ['notARealColumn'])).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws NotFoundError for an unregistered entity', async () => {
      await expect(exportEntity('doesNotExist', 'csv', 'ALL', actor, {})).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('import.service', () => {
    it('creates valid rows and reports failures in partial mode, without aborting the whole batch', async () => {
      const csv = ['source,priority,ownerId', `WEBSITE,HIGH,${actor.sub}`, ',HIGH,'].join('\r\n');
      const result = await importEntity('leads', Buffer.from(csv, 'utf-8'), { dryRun: false, mode: 'partial' });

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBeGreaterThanOrEqual(1);
      expect(result.createdIds).toHaveLength(1);

      const created = await LeadModel.findById(result.createdIds[0]);
      expect(created?.source).toBe('WEBSITE');
    });

    it('does not create anything when dryRun is true', async () => {
      const csv = ['source,priority,ownerId', `WEBSITE,NORMAL,${actor.sub}`].join('\r\n');
      const beforeCount = await LeadModel.countDocuments();
      const result = await importEntity('leads', Buffer.from(csv, 'utf-8'), { dryRun: true, mode: 'partial' });

      expect(result.successCount).toBe(1);
      expect(result.dryRun).toBe(true);
      expect(await LeadModel.countDocuments()).toBe(beforeCount);
    });

    it('aborts the entire batch in strict mode when any row fails validation', async () => {
      const csv = ['source,priority,ownerId', `WEBSITE,NORMAL,${actor.sub}`, ',NORMAL,'].join('\r\n');
      const beforeCount = await LeadModel.countDocuments();
      const result = await importEntity('leads', Buffer.from(csv, 'utf-8'), { dryRun: false, mode: 'strict' });

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBeGreaterThanOrEqual(1);
      expect(await LeadModel.countDocuments()).toBe(beforeCount);
    });

    it('builds nested contacts/addresses for a customer import row', async () => {
      const csv = [
        'name,mobile,email,addressLine1,city,state,pinCode',
        'CSV Customer,9123456780,csvcustomer@test.local,MG Road,Delhi,Delhi,110004',
      ].join('\r\n');
      const result = await importEntity('customers', Buffer.from(csv, 'utf-8'), { dryRun: false, mode: 'partial' });

      expect(result.successCount).toBe(1);
      const created = await CustomerModel.findById(result.createdIds[0]);
      expect(created?.contacts[0]?.mobile).toBe('9123456780');
      expect(created?.addresses[0]?.city).toBe('Delhi');
    });
  });
});
