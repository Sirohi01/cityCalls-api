// Throwaway E2E script (targeted retry) — completes verification of the
// Reopen approval workflow's APPROVE path + staff-direct-reopen regression
// check. The reject path already passed in full via e2e_reopen_approval.ts.
// OTP login is skipped here (mints a JWT directly via signAccessToken) purely
// to dodge the otpRateLimit hit during repeated E2E retries — OTP login
// itself has already been exercised and verified many times this session.
// Deleted after use.
import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { signAccessToken } from '../src/lib/jwt';
import { NotificationModel } from '../src/modules/notifications/notificationTemplates.model';
import { UserModel } from '../src/modules/users/users.model';
import { CustomerModel } from '../src/modules/customers/customers.model';

const BASE = 'http://127.0.0.1:4000/api/v1';

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, extra?: string) {
  if (ok) { pass++; console.log(`✅ ${label}`); }
  else { fail++; console.log(`❌ ${label}${extra ? ' — ' + extra : ''}`); }
}

async function main() {
  await mongoose.connect(env.mongodbUri);

  const adminLogin = await call('POST', '/auth/login', undefined, { identifier: 'superadmin@citycalls.local', password: '12345678' });
  const adminToken = adminLogin.data.data.accessToken as string;
  console.log('Logged in as super admin\n');

  // Same SR pair as before: srForApprove (index 1) untouched by the reject
  // test, srForStaff (index 2) for the staff-direct regression check.
  const srListRes = await call('GET', '/service-requests?limit=100', adminToken);
  const closedSrs = (srListRes.data.data as any[]).filter((s) => s.status === 'CLOSED');
  const branchId = closedSrs[0].branchId;
  const srSameBranch = closedSrs.filter((s) => s.branchId === branchId);
  const srForApprove = srSameBranch.find((s) => s._id === '6a5aed7b95a7ebaffc478f61');
  if (!srForApprove) throw new Error('srForApprove not found or not CLOSED anymore — check state');
  console.log('SR for approve test:', srForApprove._id, srForApprove.number);

  const csUser = await UserModel.findOne({ mobile: '9700000021' });
  if (!csUser) throw new Error('CS exec test user not found');
  const csToken = signAccessToken({ sub: csUser._id.toString(), role: 'CUSTOMER_SUPPORT_EXECUTIVE', branchId: (csUser as any).branchId?.toString() });

  let cust2User = await UserModel.findOne({ mobile: '9469983790' });
  if (!cust2User) {
    // OTP verify never completed in the earlier rate-limited run, so
    // progressive-registration never created this User — create it directly,
    // mirroring what verifyOtp would have done.
    cust2User = await UserModel.create({ name: 'E2E Customer 2', mobile: '9469983790', role: 'CUSTOMER', status: 'ACTIVE', passwordHash: 'x' });
    console.log('Created customer 2 user directly (OTP path never completed earlier):', cust2User._id.toString());
  }
  const cust2Token = signAccessToken({ sub: cust2User._id.toString(), role: 'CUSTOMER' });

  // Make sure the Customer doc backing srForApprove is linked to this user (idempotent).
  await CustomerModel.updateOne({ _id: srForApprove.customerId }, { userId: cust2User._id });

  const req2 = await call('POST', `/service-requests/${srForApprove._id}/reopen`, cust2Token, { reason: 'AC still not cooling properly' });
  console.log('Customer 2 reopen request status:', req2.status, req2.data.message);
  check('Customer 2 reopen request returns 201 with "submitted for review" message', req2.status === 201 && /review/i.test(req2.data.message), JSON.stringify(req2.data));

  const pendingList2 = await call('GET', '/reopen-requests?status=PENDING&limit=100', adminToken);
  const pendingRecord2 = (pendingList2.data.data as any[]).find((r) => r.originalServiceRequestId === srForApprove._id);
  check('Reopen request appears in PENDING list', !!pendingRecord2, JSON.stringify(pendingList2.data.data.map((r: any) => r.originalServiceRequestId)));

  const approveRes = await call('PATCH', `/reopen-requests/${pendingRecord2.id}/approve`, csToken);
  console.log('\nApprove status:', approveRes.status, JSON.stringify(approveRes.data.errors ?? ''));
  check('CS exec can approve a pending reopen request', approveRes.status === 200 && approveRes.data.data.reopenRecord?.status === 'APPROVED', JSON.stringify(approveRes.data));
  const newSrId = approveRes.data.data.newServiceRequest?._id;
  check('Approval creates a new linked service request', !!newSrId);

  const srAfterApprove = await call('GET', `/service-requests/${srForApprove._id}`, adminToken);
  check('Original SR flips to REOPENED only after approval', srAfterApprove.data.data.status === 'REOPENED', srAfterApprove.data.data.status);

  const newSrRes = newSrId ? await call('GET', `/service-requests/${newSrId}`, adminToken) : null;
  check('New SR is linked back to the original', newSrRes?.data.data?.originalServiceRequestId === srForApprove._id);

  await new Promise((r) => setTimeout(r, 800));
  const approveNotif = await NotificationModel.findOne({ triggerKey: 'REOPEN_APPROVED', recipientUserId: cust2User._id }).sort({ createdAt: -1 });
  check('Customer got a REOPEN_APPROVED notification', !!approveNotif);

  // Double-approve should now fail (already reviewed).
  const doubleApprove = await call('PATCH', `/reopen-requests/${pendingRecord2.id}/approve`, csToken);
  check('Cannot review an already-reviewed reopen request again', doubleApprove.status === 409, `got ${doubleApprove.status}`);

  console.log('\n--- Staff direct-reopen regression check ---');
  const srForStaff = srSameBranch.find((s) => s._id === '6a5aed7f95a7ebaffc478f8b') ?? srSameBranch[2];
  if (srForStaff) {
    console.log('SR for staff test:', srForStaff._id, srForStaff.number);
    const directRes = await call('POST', `/service-requests/${srForStaff._id}/reopen`, adminToken, { reason: 'Staff-initiated direct reopen' });
    check('Admin direct reopen still applies immediately (message says "reopened successfully")', directRes.status === 201 && /reopened successfully/i.test(directRes.data.message), directRes.data.message);
    const srAfterDirect = await call('GET', `/service-requests/${srForStaff._id}`, adminToken);
    check('Admin direct reopen immediately flips original to REOPENED', srAfterDirect.data.data.status === 'REOPENED');
  } else {
    console.log('No spare CLOSED SR found for staff regression check — skipping');
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exitCode = 1;

  console.log('\nCleanup refs:', {
    srForApprove: srForApprove._id,
    srForStaff: srForStaff?._id,
    newSrId,
    pendingRecord2: pendingRecord2?._id,
  });

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('E2E script failed:', e);
  process.exitCode = 1;
});
