import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';

// We build a minimal express app that mirrors the real routes
// Connect to a test database to avoid polluting production data

const TEST_DB = 'mongodb://localhost:27017/teamchat_test';
let app: express.Express;
let server: any;

beforeAll(async () => {
  await mongoose.connect(TEST_DB);
  await mongoose.connection.db!.dropDatabase();

  // Dynamically import routes after DB connection
  const { User } = await import('../src/models/User.js');
  const authRoutes = (await import('../src/routes/auth.js')).default;
  const chatRoutes = (await import('../src/routes/chat.js')).default;

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api', chatRoutes);
});

afterAll(async () => {
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
});

const TS = Date.now();
let tokenA = '';
let tokenB = '';
let userBId = '';

describe('Auth Routes', () => {
  test('POST /api/auth/register — creates user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: `jestA_${TS}`, password: 'pass123456' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe(`jestA_${TS}`);
    tokenA = res.body.token;
  });

  test('POST /api/auth/register — creates user B', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: `jestB_${TS}`, password: 'pass654321' });
    expect(res.status).toBe(201);
    tokenB = res.body.token;
    userBId = res.body.user.id;
  });

  test('POST /api/auth/register — duplicate returns 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: `jestA_${TS}`, password: 'pass123456' });
    expect(res.status).toBe(409);
  });

  test('POST /api/auth/register — missing fields returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: '' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/login — valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: `jestA_${TS}`, password: 'pass123456' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('POST /api/auth/login — wrong password returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: `jestA_${TS}`, password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me — with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe(`jestA_${TS}`);
  });

  test('GET /api/auth/me — invalid token returns 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });
});
