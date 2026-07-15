import request from 'supertest';
import { createApp } from '../../src/app';

describe('Field execution routes without a token', () => {
  it('GET /api/v1/service-requests/:id/visits returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/service-requests/000000000000000000000000/visits');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/service-requests/:id/sync-batch returns 401 before validation runs', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/service-requests/000000000000000000000000/sync-batch')
      .send({ actions: [] });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/service-requests/:id/completion-otp/request returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/service-requests/000000000000000000000000/completion-otp/request');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/service-requests/:id/location-ping returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/service-requests/000000000000000000000000/location-ping')
      .send({ lat: 28.6, lng: 77.2 });
    expect(res.status).toBe(401);
  });
});

describe('Files routes without a token', () => {
  it('POST /api/v1/files/signed-upload returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/files/signed-upload')
      .send({ category: 'ISSUE_IMAGE', entityType: 'SERVICE_REQUEST', entityId: '000000000000000000000000' });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/files/upload returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/files/upload');
    expect(res.status).toBe(401);
  });
});
