import { connectTestDb, disconnectTestDb } from '../setup/testDb';
import { UserModel } from '../../src/modules/users/users.model';
import { CustomerModel, CustomerProductModel } from '../../src/modules/customers/customers.model';
import { ServiceModel } from '../../src/modules/catalog/catalog.model';
import { MasterModel } from '../../src/modules/config/master.model';
import { ServiceRequestModel } from '../../src/modules/service-requests/serviceRequests.model';
import { reopenServiceRequest, getReopenHistory } from '../../src/modules/service-requests/serviceRequests.service';
import { recordOutcome, scheduleHappyCall } from '../../src/modules/follow-up/happyCalls.service';
import { StatusTransitionModel } from '../../src/modules/config/statusTransition.model';
import { loadStatusEngineCache } from '../../src/lib/statusEngine';
import { AccessTokenPayload } from '../../src/lib/jwt';

// Real (in-memory) DB coverage for the two pieces of Phase 7 logic worth
// verifying against actual Mongoose behavior rather than mocks: the
// root-tracing reopenCount (a request reopened twice should count 2 against
// the very first original, not just its immediate parent) and warranty
// applicability, plus the happy-call outcome closing its linked request.
describe('Reopen and Happy Call flow (real in-memory MongoDB)', () => {
  jest.setTimeout(60_000);
  let actor: AccessTokenPayload;
  let serviceId: string;
  let customerId: string;
  let brandId: string;
  let productTypeId: string;

  beforeAll(async () => {
    await connectTestDb();

    await StatusTransitionModel.create([
      { entityType: 'SERVICE_REQUEST', fromStatus: 'PAID', toStatus: 'REOPENED', allowedRoles: ['SUPER_ADMIN'] },
      { entityType: 'SERVICE_REQUEST', fromStatus: 'REOPENED', toStatus: 'REOPENED', allowedRoles: ['SUPER_ADMIN'] },
      { entityType: 'SERVICE_REQUEST', fromStatus: 'HAPPY_CALL_PENDING', toStatus: 'CLOSED', allowedRoles: ['SUPER_ADMIN'] },
    ]);
    await loadStatusEngineCache();

    const user = await UserModel.create({
      name: 'Admin',
      email: 'admin2@test.local',
      mobile: '9888888888',
      passwordHash: 'x',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    });
    actor = { sub: user._id.toString(), role: 'SUPER_ADMIN' };

    const category = await MasterModel.create({ masterType: 'SERVICE_CATEGORY', key: 'AC', label: 'AC Repair' });
    const service = await ServiceModel.create({ name: 'AC Repair', categoryId: category._id, active: true });
    serviceId = service._id.toString();

    const customer = await CustomerModel.create({
      customerType: 'INDIVIDUAL',
      name: 'Test Customer',
      contacts: [{ name: 'Test Customer', mobile: '9000000000', isPrimary: true }],
      addresses: [{ line1: 'Flat 1', city: 'Delhi', state: 'Delhi', pinCode: '110001', country: 'India', isDefault: true }],
    });
    customerId = customer._id.toString();

    brandId = (await MasterModel.create({ masterType: 'BRAND', key: 'LG', label: 'LG' }))._id.toString();
    productTypeId = (await MasterModel.create({ masterType: 'PRODUCT_TYPE', key: 'AC', label: 'AC' }))._id.toString();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('applies warranty when the linked product is still under warranty', async () => {
    const product = await CustomerProductModel.create({
      customerId,
      brandId,
      productTypeId,
      warrantyExpiresAt: new Date(Date.now() + 30 * 86_400_000), // 30 days from now
    });

    const original = await ServiceRequestModel.create({
      number: 'SR-TEST-0001',
      customerId,
      customerProductId: product._id,
      addressSnapshot: { line1: 'Flat 1', city: 'Delhi', state: 'Delhi', pinCode: '110001', country: 'India' },
      serviceId,
      status: 'PAID',
      source: 'CALL',
      createdBy: actor.sub,
      completedAt: new Date(),
    });

    const result = await reopenServiceRequest(original._id.toString(), 'AC not cooling again', actor);

    expect(result.warrantyApplied).toBe(true);
    expect(result.reopenCount).toBe(1);
    expect(result.newServiceRequest.isReopen).toBe(true);
    expect(result.newServiceRequest.originalServiceRequestId?.toString()).toBe(original._id.toString());

    const updatedOriginal = await ServiceRequestModel.findById(original._id);
    expect(updatedOriginal?.status).toBe('REOPENED');
  });

  it('does not apply warranty once the product warranty has expired', async () => {
    const product = await CustomerProductModel.create({
      customerId,
      brandId,
      productTypeId,
      warrantyExpiresAt: new Date(Date.now() - 30 * 86_400_000), // expired 30 days ago
    });

    const original = await ServiceRequestModel.create({
      number: 'SR-TEST-0002',
      customerId,
      customerProductId: product._id,
      addressSnapshot: { line1: 'Flat 1', city: 'Delhi', state: 'Delhi', pinCode: '110001', country: 'India' },
      serviceId,
      status: 'PAID',
      source: 'CALL',
      createdBy: actor.sub,
      completedAt: new Date(),
    });

    const result = await reopenServiceRequest(original._id.toString(), 'Same issue', actor);
    expect(result.warrantyApplied).toBe(false);
  });

  it('traces reopenCount to the root of the chain across multiple reopens', async () => {
    const original = await ServiceRequestModel.create({
      number: 'SR-TEST-0003',
      customerId,
      addressSnapshot: { line1: 'Flat 1', city: 'Delhi', state: 'Delhi', pinCode: '110001', country: 'India' },
      serviceId,
      status: 'PAID',
      source: 'CALL',
      createdBy: actor.sub,
      completedAt: new Date(),
    });

    const first = await reopenServiceRequest(original._id.toString(), 'First recurrence', actor);
    expect(first.reopenCount).toBe(1);

    // Second-generation reopen: mark the FIRST reopen's SR as PAID so it can be reopened again.
    await ServiceRequestModel.findByIdAndUpdate(first.newServiceRequest._id, { status: 'PAID', completedAt: new Date() });
    const second = await reopenServiceRequest(first.newServiceRequest._id.toString(), 'Second recurrence', actor);

    // Must count against the ROOT original (2), not reset to 1 against its immediate parent.
    expect(second.reopenCount).toBe(2);

    const history = await getReopenHistory(second.newServiceRequest._id.toString());
    expect(history).toHaveLength(2);
    expect(history[0].originalServiceRequestId.toString()).toBe(original._id.toString());
    expect(history[1].originalServiceRequestId.toString()).toBe(original._id.toString());
  });

  it('escalates automatically after 3 or more reopens on the same chain', async () => {
    const original = await ServiceRequestModel.create({
      number: 'SR-TEST-0004',
      customerId,
      addressSnapshot: { line1: 'Flat 1', city: 'Delhi', state: 'Delhi', pinCode: '110001', country: 'India' },
      serviceId,
      status: 'PAID',
      source: 'CALL',
      createdBy: actor.sub,
      completedAt: new Date(),
    });

    let currentId = original._id.toString();
    let lastResult;
    for (let i = 0; i < 3; i++) {
      lastResult = await reopenServiceRequest(currentId, `Recurrence ${i + 1}`, actor);
      currentId = lastResult.newServiceRequest._id.toString();
      if (i < 2) {
        await ServiceRequestModel.findByIdAndUpdate(currentId, { status: 'PAID', completedAt: new Date() });
      }
    }

    expect(lastResult?.reopenCount).toBe(3);
    expect(lastResult?.newServiceRequest.isEscalated).toBe(true);
  });

  it('closes the linked Service Request when a happy call outcome is COMPLETED', async () => {
    const sr = await ServiceRequestModel.create({
      number: 'SR-TEST-0005',
      customerId,
      addressSnapshot: { line1: 'Flat 1', city: 'Delhi', state: 'Delhi', pinCode: '110001', country: 'India' },
      serviceId,
      status: 'HAPPY_CALL_PENDING',
      source: 'CALL',
      createdBy: actor.sub,
    });

    const happyCall = await scheduleHappyCall(sr._id.toString(), actor.sub);
    await recordOutcome(
      happyCall._id.toString(),
      { status: 'COMPLETED', outcome: 'Satisfied', customerSatisfaction: 5, reopenRequested: false, escalationRequired: false },
      actor
    );

    const updatedSr = await ServiceRequestModel.findById(sr._id);
    expect(updatedSr?.status).toBe('CLOSED');
  });
});
