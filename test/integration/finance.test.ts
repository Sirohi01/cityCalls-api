import request from 'supertest';
import { createApp } from '../../src/app';

describe('Finance routes without a token', () => {
  it('GET /api/v1/estimates returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/estimates');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/estimates returns 401 before validation runs', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/estimates').send({});
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/invoices/:id/payments returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/invoices/000000000000000000000000/payments')
      .send({ amount: 100, method: 'CASH' });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/credit-notes returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/credit-notes').send({});
    expect(res.status).toBe(401);
  });
});

describe('Vendor finance routes without a token', () => {
  it('GET /api/v1/vendor-invoices returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/vendor-invoices');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/vendor-payouts returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/vendor-payouts').send({});
    expect(res.status).toBe(401);
  });
});
