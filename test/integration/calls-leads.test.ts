import request from 'supertest';
import { createApp } from '../../src/app';

describe('Calls routes without a token', () => {
  it('GET /api/v1/calls returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/calls');
    expect(res.status).toBe(401);
  });
});

describe('Leads routes without a token', () => {
  it('GET /api/v1/leads returns 401, not a crash', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/leads');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/leads/bulk-assign resolves before /leads/:id would incorrectly match it', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/leads/bulk-assign').send({ leadIds: ['x'], ownerId: 'y' });
    // Route-ordering regression check, same class of bug as customers/duplicates.
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/leads/merge resolves before /leads/:id would incorrectly match it', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/leads/merge').send({ primaryLeadId: 'x', duplicateLeadId: 'y' });
    expect(res.status).toBe(401);
  });
});
