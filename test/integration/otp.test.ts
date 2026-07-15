import request from 'supertest';
import { createApp } from '../../src/app';

describe('POST /api/v1/auth/otp/request', () => {
  it('returns a 422 validation error for an invalid mobile number', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/auth/otp/request').send({ mobile: '123' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/v1/auth/otp/verify', () => {
  it('returns a 422 validation error when otp is not 6 digits', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/auth/otp/verify').send({ mobile: '9876543210', otp: '123' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/v1/auth/password/reset', () => {
  it('returns a 422 validation error when newPassword is too short', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/auth/password/reset')
      .send({ token: 'sometoken', newPassword: 'short' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/v1/auth/sessions', () => {
  it('returns 401 without a token', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/auth/sessions');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/v1/users', () => {
  it('returns 401 without a token, not a crash', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/users');

    expect(res.status).toBe(401);
  });
});
