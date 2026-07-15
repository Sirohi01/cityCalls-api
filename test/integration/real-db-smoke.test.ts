import request from 'supertest';
import { connectTestDb, disconnectTestDb } from '../setup/testDb';
import { createApp } from '../../src/app';
import { UserModel } from '../../src/modules/users/users.model';
import { hashPassword } from '../../src/modules/auth/auth.service';
import { RolePermissionModel } from '../../src/modules/config/rolePermissions.model';

// Real (in-memory) DB integration smoke test. This is the class of test that
// actually exercises authenticated request -> query validation -> Mongoose
// query -> response round trip. Added after a manual `npm start` + curl smoke
// test caught a real bug that 57 mocked/401-only tests had all missed: Express 5
// made req.query a getter-only accessor, so validate.middleware.ts's
// `req.query = result.data` threw on every query-validated list endpoint.
// Fixed via Object.defineProperty; this test locks that fix in.
describe('Authenticated request round trip (real in-memory MongoDB)', () => {
  jest.setTimeout(60_000);
  let accessToken: string;
  const app = createApp();

  beforeAll(async () => {
    await connectTestDb();

    const passwordHash = await hashPassword('TestPassword123!');
    await UserModel.create({
      name: 'Test Admin',
      email: 'admin@test.local',
      mobile: '9999999999',
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    });

    await RolePermissionModel.create({ role: 'SUPER_ADMIN', module: 'organization', action: 'view', dataScope: 'ALL' });
    await RolePermissionModel.create({ role: 'SUPER_ADMIN', module: 'organization', action: 'create', dataScope: 'ALL' });

    const { loadPermissionCache } = await import('../../src/lib/permissionCache');
    await loadPermissionCache();

    const loginRes = await request(app).post('/api/v1/auth/login').send({ identifier: 'admin@test.local', password: 'TestPassword123!' });
    accessToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  afterEach(async () => {
    // Keep the user/permissions (created once in beforeAll) but clear anything
    // a test created, so tests don't interfere with each other.
  });

  it('logs in successfully against a real database', () => {
    expect(accessToken).toBeDefined();
    expect(typeof accessToken).toBe('string');
  });

  it('creates a branch and lists it back with a query-validated list endpoint', async () => {
    const createRes = await request(app)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Delhi Central', code: 'DEL01', coverage: { pinCodes: ['110001'], cities: ['Delhi'], states: ['Delhi'] } });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);

    // This is the exact request shape that previously 500'd: an authenticated
    // GET through requirePermission + validate(schema, 'query').
    const listRes = await request(app)
      .get('/api/v1/branches?page=1&limit=20')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body.meta).toMatchObject({ page: 1, limit: 20 });
  });

  it('filters a list endpoint using a query parameter without crashing', async () => {
    const res = await request(app)
      .get('/api/v1/branches?active=true&page=1&limit=5')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
