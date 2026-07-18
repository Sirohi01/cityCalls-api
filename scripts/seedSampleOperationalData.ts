import 'dotenv/config';
import { connectDb, disconnectDb } from '../src/lib/db';
import { UserModel } from '../src/modules/users/users.model';
import { EmployeeModel } from '../src/modules/employees/employees.model';
import { BranchModel } from '../src/modules/organization/organization.model';
import { MasterModel } from '../src/modules/config/master.model';
import { ServiceModel } from '../src/modules/catalog/catalog.model';
import { CustomerModel } from '../src/modules/customers/customers.model';
import { LeadModel, LEAD_STAGES, LeadStage } from '../src/modules/leads/leads.model';
import { CallModel, CALL_TYPES, CallType } from '../src/modules/calls/calls.model';
import { ServiceRequestModel, SERVICE_REQUEST_STATUSES, ServiceRequestStatus } from '../src/modules/service-requests/serviceRequests.model';
import { InvoiceModel } from '../src/modules/finance/invoices.model';
import { CampaignModel } from '../src/modules/marketing/campaigns.model';
import { NotificationTemplateModel } from '../src/modules/notifications/notificationTemplates.model';
import { hashPassword } from '../src/modules/auth/auth.service';
import { getNextNumber, currentFinancialYear } from '../src/lib/numbering';
import { Types } from 'mongoose';

// Realistic demo transaction volume so the operational dashboard/reports have
// real (if synthetic) data to render — the org/RBAC/masters seed alone leaves
// every report and chart empty. Guarded by the "already seeded" check at the
// bottom so re-running `npm run seed` doesn't keep piling on more each time.

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick<T>(weighted: [T, number][]): T {
  const total = weighted.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [value, weight] of weighted) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return weighted[weighted.length - 1][0];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(randomInt(8, 19), randomInt(0, 59), 0, 0);
  return d;
}

function randomMobile(): string {
  return `9${randomInt(100000000, 999999999)}`;
}

const FIRST_NAMES = [
  'Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Rohan', 'Neha', 'Suresh', 'Pooja',
  'Ankit', 'Kavita', 'Deepak', 'Meera', 'Sanjay', 'Ritu', 'Manish', 'Divya', 'Arjun', 'Swati',
  'Rajesh', 'Kirti', 'Vivek', 'Nisha', 'Karan', 'Shalini', 'Gaurav', 'Preeti', 'Nikhil', 'Anita',
  'Sandeep', 'Rekha', 'Ashok', 'Sunita', 'Vinay', 'Geeta', 'Pankaj', 'Seema', 'Ravi', 'Madhuri',
];
const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Kumar', 'Singh', 'Agarwal', 'Mehta', 'Joshi', 'Malhotra', 'Kapoor',
  'Chopra', 'Bansal', 'Rastogi', 'Saxena', 'Tiwari', 'Yadav', 'Nair', 'Reddy', 'Rao', 'Iyer',
];

function randomName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

async function main() {
  await connectDb();

  const alreadySeeded = await CustomerModel.countDocuments();
  if (alreadySeeded > 0) {
    console.log(`[seed-sample] ${alreadySeeded} customers already exist — skipping (delete them first to reseed).`);
    await disconnectDb();
    return;
  }

  const branches = await BranchModel.find().lean();
  if (branches.length === 0) {
    throw new Error('No branches found — run `npm run seed` first to seed the branch network.');
  }
  // Weight Delhi NCR branches heavier — it's the priority/launch market.
  const ncrCodes = new Set(['DELCS', 'DELNE', 'DELW', 'GGN', 'NOI', 'FBD', 'GZB']);
  const branchWeights: [typeof branches[number], number][] = branches.map((b) => [b, ncrCodes.has(b.code) ? 5 : 1]);

  const categories = await MasterModel.find({ masterType: 'SERVICE_CATEGORY' }).lean();
  if (categories.length === 0) {
    throw new Error('No SERVICE_CATEGORY masters found — run `npm run seed` first.');
  }
  const leadSources = await MasterModel.find({ masterType: 'LEAD_SOURCE' }).lean();

  // --- Staff users ---
  console.log('[seed-sample] creating staff users...');
  const passwordHash = await hashPassword('Passw0rd@Seed');
  const ncrBranches = branches.filter((b) => ncrCodes.has(b.code));

  const branchManagers = [];
  for (let i = 0; i < 3; i++) {
    branchManagers.push(
      await UserModel.create({
        name: randomName(),
        mobile: randomMobile(),
        email: `bm${i + 1}@citycalls.local`,
        passwordHash,
        role: 'BRANCH_MANAGER',
        status: 'ACTIVE',
        branchId: pick(ncrBranches)._id,
      })
    );
  }

  const salesExecutives = [];
  for (let i = 0; i < 4; i++) {
    salesExecutives.push(
      await UserModel.create({
        name: randomName(),
        mobile: randomMobile(),
        email: `sales${i + 1}@citycalls.local`,
        passwordHash,
        role: 'SALES_EXECUTIVE',
        status: 'ACTIVE',
        branchId: pick(ncrBranches)._id,
      })
    );
  }

  const callExecutives = [];
  for (let i = 0; i < 3; i++) {
    callExecutives.push(
      await UserModel.create({
        name: randomName(),
        mobile: randomMobile(),
        email: `callexec${i + 1}@citycalls.local`,
        passwordHash,
        role: 'CALL_EXECUTIVE',
        status: 'ACTIVE',
        branchId: pick(ncrBranches)._id,
      })
    );
  }

  const technicianUsers = [];
  const technicianEmployees = [];
  for (let i = 0; i < 6; i++) {
    const branch = pick(ncrBranches);
    const user = await UserModel.create({
      name: randomName(),
      mobile: randomMobile(),
      email: `tech${i + 1}@citycalls.local`,
      passwordHash,
      role: 'TECHNICIAN',
      status: 'ACTIVE',
      branchId: branch._id,
    });
    technicianUsers.push(user);
    technicianEmployees.push(
      await EmployeeModel.create({
        userId: user._id,
        branchId: branch._id,
        skills: ['AC_REPAIR', 'ELECTRICAL', 'PLUMBING'].slice(0, randomInt(1, 3)),
        dailyCapacity: randomInt(4, 8),
        active: true,
      })
    );
  }

  // --- Service catalog ---
  console.log('[seed-sample] creating service catalog entries...');
  const serviceDefs = [
    ['AC Repair & Gas Refilling', 'AC_REPAIR_SERVICE', 1499],
    ['AC Installation', 'AC_REPAIR_SERVICE', 1999],
    ['Refrigerator Repair', 'APPLIANCE_REPAIR', 899],
    ['Washing Machine Repair', 'APPLIANCE_REPAIR', 799],
    ['Water Purifier Service', 'WATER_PURIFIER', 599],
    ['Chimney Deep Cleaning', 'CHIMNEY_KITCHEN', 899],
    ['Geyser Repair', 'GEYSER_REPAIR', 699],
    ['Electrical Wiring Fix', 'ELECTRICIAN', 399],
    ['Tap & Pipe Repair', 'PLUMBER', 349],
    ['Modular Furniture Repair', 'CARPENTER', 599],
    ['Full Home Painting', 'PAINTING_WATERPROOFING', 12999],
    ['General Pest Control', 'PEST_CONTROL', 1299],
    ['Home Deep Cleaning', 'HOME_DEEP_CLEANING', 2499],
    ['Sofa Cleaning', 'SOFA_CARPET_CLEANING', 999],
    ["Women's Salon at Home", 'SALON_FOR_WOMEN', 799],
  ] as const;

  const services = [];
  for (const [name, categoryKey, basePrice] of serviceDefs) {
    const category = categories.find((c) => c.key === categoryKey);
    if (!category) continue;
    services.push(
      await ServiceModel.create({
        name,
        categoryId: category._id,
        pricing: { basePrice, visitingCharge: 99, inspectionCharge: 0, emergencyCharge: 299 },
        slaMinutes: randomInt(120, 1440),
        active: true,
      })
    );
  }

  // --- Customers ---
  console.log('[seed-sample] creating customers...');
  const customers = [];
  for (let i = 0; i < 45; i++) {
    const branch = weightedPick(branchWeights);
    const pinCode = branch.coverage?.pinCodes?.[0] ?? '110001';
    const city = branch.coverage?.cities?.[0] ?? 'New Delhi';
    const state = branch.coverage?.states?.[0] ?? 'Delhi';
    const name = randomName();
    const isBusiness = Math.random() < 0.15;
    customers.push(
      await CustomerModel.create({
        customerType: isBusiness ? 'BUSINESS' : 'INDIVIDUAL',
        name,
        businessName: isBusiness ? `${name.split(' ')[0]} Enterprises` : undefined,
        email: `${name.toLowerCase().replace(' ', '.')}${i}@example.com`,
        contacts: [{ name, mobile: randomMobile(), isPrimary: true }],
        addresses: [
          {
            line1: `House ${randomInt(1, 400)}, Block ${pick(['A', 'B', 'C', 'D', 'E'])}`,
            city,
            state,
            pinCode,
            country: 'India',
            isDefault: true,
          },
        ],
        consent: { whatsapp: 'GRANTED', email: 'GRANTED', sms: 'GRANTED' },
      })
    );
  }

  // --- Leads ---
  console.log('[seed-sample] creating leads...');
  const leadStageWeights: [LeadStage, number][] = [
    ['NEW', 10], ['CONTACT_ATTEMPTED', 8], ['CONNECTED', 6], ['REQUIREMENT_COLLECTED', 6],
    ['QUALIFIED', 5], ['ESTIMATE_REQUIRED', 4], ['ESTIMATE_SHARED', 4], ['NEGOTIATION', 3],
    ['FOLLOW_UP', 5], ['CONVERTED', 14], ['LOST', 6], ['NOT_INTERESTED', 4], ['INVALID', 2], ['DUPLICATE', 1],
  ];
  const leads = [];
  for (let i = 0; i < 65; i++) {
    const branch = weightedPick(branchWeights);
    const stage = weightedPick(leadStageWeights);
    const createdAt = daysAgo(randomInt(0, 60));
    const number = await getNextNumber('LEAD', branch._id.toString());
    leads.push(
      await LeadModel.create({
        number,
        stage,
        source: leadSources.length ? pick(leadSources).key : 'WEBSITE',
        priority: weightedPick([['LOW', 3], ['NORMAL', 6], ['HIGH', 3], ['URGENT', 1]]),
        ownerId: pick(salesExecutives)._id,
        contactName: randomName(),
        contactMobile: randomMobile(),
        branchId: branch._id,
        productInterest: pick(serviceDefs)[0],
        requirement: 'Customer reported an issue and requested a service visit.',
        createdAt,
        updatedAt: createdAt,
      })
    );
  }

  // --- Calls ---
  console.log('[seed-sample] creating calls...');
  const allStaff = [...branchManagers, ...salesExecutives, ...callExecutives];
  for (let i = 0; i < 55; i++) {
    const branch = weightedPick(branchWeights);
    const createdAt = daysAgo(randomInt(0, 60));
    const number = await getNextNumber('CALL', branch._id.toString());
    const relatedLead = Math.random() < 0.4 ? pick(leads) : undefined;
    await CallModel.create({
      number,
      callType: weightedPick<CallType>([
        ['INITIAL', 5], ['REQUIREMENT', 4], ['PRE_SERVICE', 3],
        ['VISIT_UPDATE', 2], ['POST_SERVICE_FOLLOWUP', 3], ['HAPPY_CALL', 2],
      ] as [CallType, number][]),
      direction: weightedPick([['INCOMING', 6], ['OUTGOING', 4]] as ['INCOMING' | 'OUTGOING', number][]),
      callerNumber: randomMobile(),
      customerName: randomName(),
      callDate: createdAt,
      callTime: `${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`,
      priority: pick(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
      notes: 'Customer called regarding a service issue. Logged for follow-up.',
      branchId: branch._id,
      createdBy: pick(allStaff)._id,
      relatedLeadId: relatedLead?._id,
      createdAt,
      updatedAt: createdAt,
    });
  }

  // --- Service Requests ---
  console.log('[seed-sample] creating service requests...');
  const srStatusWeights: [ServiceRequestStatus, number][] = [
    ['NEW', 4], ['ASSIGNED_TO_BRANCH', 3], ['ACCEPTED', 3], ['APPOINTMENT_SCHEDULED', 3],
    ['TECHNICIAN_EN_ROUTE', 2], ['WORK_IN_PROGRESS', 3], ['ESTIMATE_SHARED', 2],
    ['SERVICE_COMPLETED', 4], ['PAYMENT_PENDING', 2], ['PAID', 3], ['CLOSED', 22],
    ['CANCELLED', 3], ['REOPENED', 1], ['FOLLOW_UP_PENDING', 2],
  ];
  const serviceRequests = [];
  for (let i = 0; i < 95; i++) {
    const branch = weightedPick(branchWeights);
    const status = weightedPick(srStatusWeights);
    const service = pick(services);
    const customer = pick(customers);
    const createdAt = daysAgo(randomInt(0, 60));
    const isClosed = status === 'CLOSED' || status === 'PAID';
    const completedAt = isClosed ? new Date(createdAt.getTime() + randomInt(2, 72) * 3600_000) : undefined;
    const number = await getNextNumber('SERVICE_REQUEST', branch._id.toString());
    const technician = pick(technicianEmployees);
    serviceRequests.push(
      await ServiceRequestModel.create({
        number,
        status,
        priority: pick(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
        customerId: customer._id,
        serviceId: service._id,
        branchId: branch._id,
        addressSnapshot: customer.addresses[0],
        assigneeType: 'EMPLOYEE',
        assigneeId: technician._id,
        isEscalated: Math.random() < 0.08,
        source: pick(['CALL', 'CUSTOMER_APP', 'WALK_IN']),
        createdBy: pick(allStaff)._id,
        sla: { dueAt: new Date(createdAt.getTime() + 24 * 3600_000) },
        completedAt,
        closedAt: status === 'CLOSED' ? completedAt : undefined,
        createdAt,
        updatedAt: completedAt ?? createdAt,
      })
    );
  }

  // --- Invoices (for completed/closed/paid service requests) ---
  console.log('[seed-sample] creating invoices...');
  const billable = serviceRequests.filter((sr) => ['CLOSED', 'PAID', 'PAYMENT_PENDING'].includes(sr.status));
  for (const sr of billable) {
    if (Math.random() < 0.15) continue; // not every closed job gets billed in this sample
    const service = services.find((s) => s._id.equals(sr.serviceId)) ?? pick(services);
    const basePrice = service.pricing.basePrice;
    const qty = 1;
    const lineTotal = basePrice * qty;
    const tax = Math.round(lineTotal * 0.18);
    const total = lineTotal + tax;
    const status = weightedPick<'PAID' | 'PARTIALLY_PAID' | 'ISSUED' | 'CANCELLED'>([
      ['PAID', 6], ['PARTIALLY_PAID', 2], ['ISSUED', 1], ['CANCELLED', 1],
    ]);
    const amountPaid = status === 'PAID' ? total : status === 'PARTIALLY_PAID' ? Math.round(total * 0.5) : 0;
    const number = await getNextNumber('INVOICE', sr.branchId?.toString());
    await InvoiceModel.create({
      number,
      serviceRequestId: sr._id,
      customerId: sr.customerId,
      branchId: sr.branchId,
      financialYear: currentFinancialYear(),
      items: [{ description: service.name, qty, unitPrice: basePrice, lineTotal }],
      subtotal: lineTotal,
      taxBreakup: { cgst: Math.round(tax / 2), sgst: Math.round(tax / 2), igst: 0 },
      total,
      amountPaid,
      status,
      createdAt: sr.completedAt ?? sr.createdAt,
      updatedAt: sr.completedAt ?? sr.createdAt,
    });
  }

  // --- Campaigns ---
  console.log('[seed-sample] creating campaigns...');
  const waTemplate = await NotificationTemplateModel.findOne({ channel: 'WHATSAPP' });
  const emailTemplate = await NotificationTemplateModel.findOne({ channel: 'EMAIL' });
  const campaignDefs = [
    ['Monsoon AC Service Reminder', 'WHATSAPP', waTemplate, 'COMPLETED', 420, 398, 210, 22],
    ['Diwali Home Cleaning Offer', 'WHATSAPP', waTemplate, 'COMPLETED', 610, 585, 340, 25],
    ['Warranty Expiry — Win-back', 'EMAIL', emailTemplate, 'COMPLETED', 350, 340, 140, 10],
    ['New Year AMC Renewal', 'EMAIL', emailTemplate, 'SENDING', 180, 0, 0, 0],
  ] as const;
  for (const [name, channel, template, status, sent, delivered, read, failed] of campaignDefs) {
    if (!template) continue;
    await CampaignModel.create({
      name,
      channel,
      templateId: template._id,
      audienceFilter: {},
      status,
      stats: { sent, delivered, read, failed },
      createdBy: branchManagers[0]._id,
    });
  }

  console.log(
    `[seed-sample] done — ${branchManagers.length + salesExecutives.length + callExecutives.length + technicianUsers.length} staff, ${services.length} services, ${customers.length} customers, ${leads.length} leads, 55 calls, ${serviceRequests.length} service requests, campaigns seeded.`
  );
  await disconnectDb();
}

main().catch((err) => {
  console.error('[seed-sample] failed', err);
  process.exit(1);
});
