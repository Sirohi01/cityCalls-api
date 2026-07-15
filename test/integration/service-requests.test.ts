import request from 'supertest';
import { createApp } from '../../src/app';

describe('Service Request routes without a token', () => {
  it('GET /api/v1/service-requests returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/service-requests');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/service-requests returns 401 before validation runs', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/service-requests').send({});
    expect(res.status).toBe(401);
  });

  it('PATCH /api/v1/service-requests/:id/status returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app)
      .patch('/api/v1/service-requests/000000000000000000000000/status')
      .send({ toStatus: 'ACCEPTED' });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/service-requests/:id/assign returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/service-requests/000000000000000000000000/assign')
      .send({ assigneeType: 'EMPLOYEE', assigneeId: '000000000000000000000000' });
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/service-requests/:id/assignment-candidates returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/service-requests/000000000000000000000000/assignment-candidates');
    expect(res.status).toBe(401);
  });
});
