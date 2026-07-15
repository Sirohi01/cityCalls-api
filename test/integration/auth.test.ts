import request from 'supertest';
import { createApp } from '../../src/app';

describe('POST /api/v1/auth/login', () => {
  it('returns a 422 validation error envelope when the body is missing fields', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/auth/login').send({});

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });
});

describe('Protected routes without a token', () => {
  it('GET /api/v1/branches returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/branches');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
