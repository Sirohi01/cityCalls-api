import request from 'supertest';
import { createApp } from '../../src/app';

describe('GET /api/v1/health', () => {
  it('returns the standard success envelope', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'ok',
      data: { env: expect.any(String) },
      meta: null,
      errors: null,
    });
  });

  it('returns a 404 envelope for an unknown route', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.errors[0].code).toBe('ROUTE_NOT_FOUND');
  });
});
