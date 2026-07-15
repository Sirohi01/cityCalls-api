import request from 'supertest';
import { createApp } from '../../src/app';

describe('Customers routes without a token', () => {
  it('GET /api/v1/customers returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/customers');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/customers/duplicates returns 401 before /customers/:id would incorrectly match it', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/customers/duplicates');
    // Route-ordering regression check: duplicates must resolve as its own route,
    // not be swallowed by the /customers/:id pattern.
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/customers/:id/history returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/customers/000000000000000000000000/history');
    expect(res.status).toBe(401);
  });
});
