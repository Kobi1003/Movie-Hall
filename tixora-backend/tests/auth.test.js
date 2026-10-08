import request from 'supertest';
import app from '../src/app.js';
import { ROLES } from '../src/config/constants.js';

describe('Authentication & Role Based Authorization', () => {
  let customerToken;
  let adminToken;

  test('Customer Signup & Login', async () => {
    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'testcustomer@tixora.io',
        password: 'Password123!',
        fullName: 'Test Customer',
        role: ROLES.CUSTOMER
      });

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.success).toBe(true);
    expect(signupRes.body.data.token).toBeDefined();

    customerToken = signupRes.body.data.token;
  });

  test('Rejects unauthenticated request on protected route', async () => {
    const res = await request(app).get('/api/v1/cinema');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('Customer role is forbidden from Cinema Owner routes', async () => {
    const res = await request(app)
      .get('/api/v1/cinema')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('Customer role is forbidden from Admin routes', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
