// Throwaway E2E script — verifies the new Reopen approval workflow:
// customer requests -> stays PENDING (SR untouched) -> CS/Happy-Call staff
// approve or reject -> only approval actually flips the SR to REOPENED and
// spawns the new linked SR; rejection leaves everything as-is and notifies
// the customer with a reason. Also regression-checks that staff
// (CALL_EXECUTIVE/ADMIN/SUPER_ADMIN) direct reopen still applies immediately.
// Deleted after use.
import * as fs from 'fs';
import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { NotificationModel } from '../src/modules/notifications/notificationTemplates.model';
import { UserModel } from '../src/modules/users/users.model';
import { CustomerModel } from '../src/modules/customers/customers.model';

const BASE = 'http://127.0.0.1:4000/api/v1';
const LOG_PATH = 'C:\\Users\\Admin\\AppData\\Local\\Temp\\citycalls-api-dev.log';

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function latestOtpFor(mobile: string): string {
  const log = fs.readFileSync(LOG_PATH, 'utf8');
  const lines = log.split('\n').filter((l: string) => l.includes(`[dev] OTP for ${mobile}:`));
  const last = lines[lines.length - 1];
  if (!last) throw new Error(`No dev OTP log line found for ${mobile}`);
  const match = last.match(/OTP for [^:]+:\s*(\d{6})/);
  if (!match) throw new Error(`Could not parse OTP from log line: ${last}`);
  return match[1];
}

async function loginViaOtp(mobile: string) {
  const req = await call('POST', '/auth/otp/request', undefined, { mobile });
  if (req.status !== 200) throw new Error(`otp request failed for ${mobile}: ${JSON.stringify(req.data)}`);
  await new Promise((r) => setTimeout(r, 500));
  const otp = latestOtpFor(mobile);
  const verify = await call('POST', '/auth/otp/verify', undefined, { mobile, otp });
  if (verify.status !== 200) throw new Error(`otp verify failed for ${mobile}: ${JSON.stringify(verify.data)}`);
  return verify.data.data.accessToken as string;
}

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, extra?: string) {
  if (ok) { pass++; console.log(`✅ ${label}`); }
  else { fail++; console.log(`❌ ${label}${extra ? ' — ' + extra : ''}`); }
}

async function main() {
  const adminLogin = await call('POST', '/auth/login', undefined, { identifier: 'superadmin@citycalls.local', password: '12345678' });
  const adminToken = adminLogin.data.data.accessToken as string;
  console.log('Logged in as super admin\n');

  // Set up a CUSTOMER_SUPPORT_EXECUTIVE reviewer in a branch, and grab two
  // real CLOSED SRs (in that same branch) to test reject + approve on.
  const srListRes = await call('GET', '/service-requests?limit=100', adminToken);
  const closedSrs = (srListRes.data.data as any[]).filter((s) => s.status === 'CLOSED');
  const branchId = closedSrs[0].branchId;
  const srSameBranch = closedSrs.filter((s) => s.branchId === branchId);
  if (srSameBranch.length < 2) throw new Error('Need at least 2 CLOSED SRs in the same branch to test with');
  const [srForReject, srForApprove] = srSameBranch;
  console.log('SR for reject test:', srForReject._id, srForReject.number);
  console.log('SR for approve test:', srForApprove._id, srForApprove.number, '\n');

  const csMobile = '9700000021';
  const csUserRes = await call('POST', '/users', adminToken, { name: 'E2E CS Exec', mobile: csMobile, password: 'testpass123', role: 'CUSTOMER_SUPPORT_EXECUTIVE', branchId });
  console.log('Created CUSTOMER_SUPPORT_EXECUTIVE user:', csUserRes.status);

  // Fetch the customers on file for these two SRs (need their mobile to log in as them).
  const cust1 = await call('GET', `/customers/${srForReject.customerId}`, adminToken);
  const cust2 = await call('GET', `/customers/${srForApprove.customerId}`, adminToken);
  const cust1Mobile = cust1.data.data.contacts?.find((c: any) => c.isPrimary)?.mobile ?? cust1.data.data.contacts?.[0]?.mobile;
  const cust2Mobile = cust2.data.data.contacts?.find((c: any) => c.isPrimary)?.mobile ?? cust2.data.data.contacts?.[0]?.mobile;
  console.log('Customer 1 mobile:', cust1Mobile, '| Customer 2 mobile:', cust2Mobile, '\n');

  // These seed Customer records (CRM-imported) have no linked userId — real
  // app bookings link this at signup, but OTP login's progressive-registration
  // only creates/finds a User, it doesn't back-link an existing Customer by
  // mobile (a separate, pre-existing gap, out of scope here). Link manually
  // so assertOwnServiceRequestAccess's ownership check has something to match.
  await mongoose.connect(env.mongodbUri);
  async function linkCustomerToUser(mobile: string, customerId: string) {
    const user = await UserModel.findOne({ mobile });
    if (user) await CustomerModel.updateOne({ _id: customerId }, { userId: user._id });
  }

  // --- Customer 1 requests reopen (for the reject-path test) ---
  const cust1Token = await loginViaOtp(cust1Mobile);
  await linkCustomerToUser(cust1Mobile, srForReject.customerId);
  const req1 = await call('POST', `/service-requests/${srForReject._id}/reopen`, cust1Token, { reason: 'Issue came back after 2 days' });
  console.log('Customer 1 reopen request status:', req1.status, req1.data.message);
  check('Customer reopen request returns 201 with "submitted for review" message', req1.status === 201 && /review/i.test(req1.data.message));

  const srAfterRequest1 = await call('GET', `/service-requests/${srForReject._id}`, adminToken);
  check('Original SR status UNCHANGED after mere request (still CLOSED)', srAfterRequest1.data.data.status === 'CLOSED', srAfterRequest1.data.data.status);

  const pendingList = await call('GET', '/reopen-requests?status=PENDING&limit=100', adminToken);
  const pendingRecord1 = (pendingList.data.data as any[]).find((r) => r.originalServiceRequestId === srForReject._id);
  check('Reopen request appears in PENDING list', !!pendingRecord1, JSON.stringify(pendingList.data.data.map((r: any) => r.originalServiceRequestId)));

  // --- CS exec REJECTS it ---
  const csToken = await loginViaOtp(csMobile);
  const rejectRes = await call('PATCH', `/reopen-requests/${pendingRecord1.id}/reject`, csToken, { reason: 'Outside policy window, no warranty on file' });
  console.log('\nReject status:', rejectRes.status, JSON.stringify(rejectRes.data.errors ?? ''));
  check('CS exec can reject a pending reopen request', rejectRes.status === 200 && rejectRes.data.data.status === 'REJECTED');

  const srAfterReject = await call('GET', `/service-requests/${srForReject._id}`, adminToken);
  check('Original SR status still CLOSED after rejection (untouched)', srAfterReject.data.data.status === 'CLOSED', srAfterReject.data.data.status);

  await new Promise((r) => setTimeout(r, 800));
  const cust1User = await UserModel.findOne({ mobile: cust1Mobile });
  const rejectNotif = await NotificationModel.findOne({ triggerKey: 'REOPEN_REJECTED', recipientUserId: cust1User?._id }).sort({ createdAt: -1 });
  check('Customer got a REOPEN_REJECTED notification with the reason', !!rejectNotif && rejectNotif.body.includes('Outside policy window'), rejectNotif?.body);

  // Double-reject should now fail (already reviewed).
  const doubleReject = await call('PATCH', `/reopen-requests/${pendingRecord1.id}/reject`, csToken, { reason: 'again' });
  check('Cannot review an already-reviewed reopen request again', doubleReject.status === 409, `got ${doubleReject.status}`);

  // --- Customer 2 requests reopen (for the approve-path test) ---
  console.log('\n--- Approve path ---');
  const cust2Token = await loginViaOtp(cust2Mobile);
  await linkCustomerToUser(cust2Mobile, srForApprove.customerId);
  const req2 = await call('POST', `/service-requests/${srForApprove._id}/reopen`, cust2Token, { reason: 'AC still not cooling properly' });
  console.log('Customer 2 reopen request status:', req2.status);
  const pendingList2 = await call('GET', '/reopen-requests?status=PENDING&limit=100', adminToken);
  const pendingRecord2 = (pendingList2.data.data as any[]).find((r) => r.originalServiceRequestId === srForApprove._id);
  check('Second reopen request also appears in PENDING list', !!pendingRecord2);

  const approveRes = await call('PATCH', `/reopen-requests/${pendingRecord2.id}/approve`, csToken);
  console.log('\nApprove status:', approveRes.status, JSON.stringify(approveRes.data.errors ?? ''));
  check('CS exec can approve a pending reopen request', approveRes.status === 200 && approveRes.data.data.reopenRecord?.status === 'APPROVED');
  const newSrId = approveRes.data.data.newServiceRequest?._id;
  check('Approval creates a new linked service request', !!newSrId);

  const srAfterApprove = await call('GET', `/service-requests/${srForApprove._id}`, adminToken);
  check('Original SR flips to REOPENED only after approval', srAfterApprove.data.data.status === 'REOPENED', srAfterApprove.data.data.status);

  const newSrRes = newSrId ? await call('GET', `/service-requests/${newSrId}`, adminToken) : null;
  check('New SR is linked back to the original', newSrRes?.data.data?.originalServiceRequestId === srForApprove._id);

  await new Promise((r) => setTimeout(r, 800));
  const cust2User = await UserModel.findOne({ mobile: cust2Mobile });
  const approveNotif = await NotificationModel.findOne({ triggerKey: 'REOPEN_APPROVED', recipientUserId: cust2User?._id }).sort({ createdAt: -1 });
  check('Customer got a REOPEN_APPROVED notification', !!approveNotif);

  // --- Regression: staff (CALL_EXECUTIVE/ADMIN) direct reopen still applies immediately ---
  console.log('\n--- Staff direct-reopen regression check ---');
  const srForStaff = srSameBranch[2] ?? closedSrs.find((s) => s._id !== srForReject._id && s._id !== srForApprove._id);
  if (srForStaff) {
    const directRes = await call('POST', `/service-requests/${srForStaff._id}/reopen`, adminToken, { reason: 'Staff-initiated direct reopen' });
    check('Admin direct reopen still applies immediately (message says "reopened successfully")', directRes.status === 201 && /reopened successfully/i.test(directRes.data.message), directRes.data.message);
    const srAfterDirect = await call('GET', `/service-requests/${srForStaff._id}`, adminToken);
    check('Admin direct reopen immediately flips original to REOPENED', srAfterDirect.data.data.status === 'REOPENED');
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exitCode = 1;

  console.log('\nCleanup refs:', {
    srForReject: srForReject._id,
    srForApprove: srForApprove._id,
    srForStaff: srForStaff?._id,
    newSrId,
    pendingRecord1: pendingRecord1?._id,
    pendingRecord2: pendingRecord2?._id,
    csUserId: csUserRes.data.data._id,
  });
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('E2E script failed:', e);
  process.exitCode = 1;
});
