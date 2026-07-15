import request from 'supertest';
import { createApp } from '../../src/app';

describe('Happy Call routes without a token', () => {
  it('GET /api/v1/happy-calls returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/happy-calls');
    expect(res.status).toBe(401);
  });

  it('PATCH /api/v1/happy-calls/:id/outcome returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app)
      .patch('/api/v1/happy-calls/000000000000000000000000/outcome')
      .send({ status: 'COMPLETED', reopenRequested: false, escalationRequired: false });
    expect(res.status).toBe(401);
  });
});

describe('Service Request reopen-history route without a token', () => {
  it('GET /api/v1/service-requests/:id/reopen-history returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/service-requests/000000000000000000000000/reopen-history');
    expect(res.status).toBe(401);
  });
});
