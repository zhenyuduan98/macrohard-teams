import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';

const TEST_DB = 'mongodb://localhost:27017/teamchat_test';
let app: express.Express;

const TS = Date.now();
let tokenA = '';
let tokenB = '';
let userBId = '';
let convId = '';

beforeAll(async () => {
  await mongoose.connect(TEST_DB);
  await mongoose.connection.db!.dropDatabase();

  const authRoutes = (await import('../src/routes/auth.js')).default;
  const chatRoutes = (await import('../src/routes/chat.js')).default;

  app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api', chatRoutes);

  // Create two users
  let res = await request(app).post('/api/auth/register').send({ username: `chatA_${TS}`, password: 'pass123456' });
  tokenA = res.body.token;

  res = await request(app).post('/api/auth/register').send({ username: `chatB_${TS}`, password: 'pass654321' });
  tokenB = res.body.token;
  userBId = res.body.user.id;
});

afterAll(async () => {
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
});

describe('Chat Routes', () => {
  test('GET /api/users — lists other users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((u: any) => u.id === userBId)).toBe(true);
  });

  test('POST /api/conversations — creates conversation', async () => {
    const res = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ participantId: userBId });
    expect(res.status).toBe(200);
    expect(res.body._id).toBeDefined();
    convId = res.body._id;
  });

  test('POST /api/conversations — idempotent', async () => {
    const res = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ participantId: userBId });
    expect(res.status).toBe(200);
    expect(res.body._id).toBe(convId);
  });

  test('POST /api/conversations — missing participant returns 400', async () => {
    const res = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('GET /api/messages/:convId — returns array', async () => {
    const res = await request(app)
      .get(`/api/messages/${convId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/conversations — lists conversations', async () => {
    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});
