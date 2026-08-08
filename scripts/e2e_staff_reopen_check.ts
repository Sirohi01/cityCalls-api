import { env } from '../src/config/env';

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

async function main() {
  const adminLogin = await call('POST', '/auth/login', undefined, { identifier: 'superadmin@citycalls.local', password: '12345678' });
  const adminToken = adminLogin.data.data.accessToken as string;
  const srListRes = await call('GET', '/service-requests?limit=100', adminToken);
  if (!srListRes.data.data) { console.log('SR list failed:', JSON.stringify(srListRes.data)); return; }
  const closedSrs = (srListRes.data.data as any[]).filter((s) => s.status === 'CLOSED');
  if (closedSrs.length === 0) { console.log('No CLOSED SR available anywhere — cannot run this check'); return; }
  const sr = closedSrs[0];
  console.log('Using SR:', sr._id, sr.number);
  const directRes = await call('POST', `/service-requests/${sr._id}/reopen`, adminToken, { reason: 'Staff-initiated direct reopen regression check' });
  console.log('Direct reopen status:', directRes.status, directRes.data.message);
  const ok1 = directRes.status === 201 && /reopened successfully/i.test(directRes.data.message);
  console.log(ok1 ? '✅ Admin direct reopen applies immediately with correct message' : '❌ FAILED message check');
  const after = await call('GET', `/service-requests/${sr._id}`, adminToken);
  const ok2 = after.data.data.status === 'REOPENED';
  console.log(ok2 ? '✅ SR flipped to REOPENED immediately' : `❌ FAILED — status is ${after.data.data.status}`);
  console.log('\nCleanup ref — restore this SR to CLOSED:', sr._id);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
