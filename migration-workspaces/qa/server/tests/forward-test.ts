// Forward & Screen Share Backend Tests
// Target: live server at https://teams.chillicurry.uk

const BASE = 'https://teams.chillicurry.uk';
const TS = Date.now();
const USER_A = { username: `fwdTestA_${TS}`, password: 'REDACTED_SET_VIA_ENV' };
const USER_B = { username: `fwdTestB_${TS}`, password: 'REDACTED_SET_VIA_ENV' };
const USER_C = { username: `fwdTestC_${TS}`, password: 'REDACTED_SET_VIA_ENV' };

let tokenA = '', tokenB = '', tokenC = '';
let userAId = '', userBId = '', userCId = '';
let convABId = '';
let convACId = '';
let msgId1 = '';
let msgId2 = '';
let msgId3 = '';

let pass = 0, fail = 0, blocked = 0;

async function test(id: string, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${id}: ${name} — PASS`);
    pass++;
  } catch (e: any) {
    console.log(`❌ ${id}: ${name} — FAIL (${e.message})`);
    fail++;
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function json(method: string, path: string, body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function run() {
  console.log('=== Setup: Register test users ===\n');

  // Register users
  {
    const r = await json('POST', '/api/auth/register', USER_A);
    assert(r.status === 201, `Register A: expected 201, got ${r.status}`);
    tokenA = r.data.token; userAId = r.data.user.id;
    console.log(`  User A: ${userAId}`);
  }
  {
    const r = await json('POST', '/api/auth/register', USER_B);
    assert(r.status === 201, `Register B: expected 201, got ${r.status}`);
    tokenB = r.data.token; userBId = r.data.user.id;
    console.log(`  User B: ${userBId}`);
  }
  {
    const r = await json('POST', '/api/auth/register', USER_C);
    assert(r.status === 201, `Register C: expected 201, got ${r.status}`);
    tokenC = r.data.token; userCId = r.data.user.id;
    console.log(`  User C: ${userCId}`);
  }

  // Create conversations
  {
    const r = await json('POST', '/api/conversations', { participantId: userBId }, tokenA);
    assert(r.status === 200, `Create conv A-B: expected 200, got ${r.status}`);
    convABId = r.data._id;
    console.log(`  Conv A-B: ${convABId}`);
  }
  {
    const r = await json('POST', '/api/conversations', { participantId: userCId }, tokenA);
    assert(r.status === 200, `Create conv A-C: expected 200, got ${r.status}`);
    convACId = r.data._id;
    console.log(`  Conv A-C: ${convACId}\n`);
  }

  // We need to send messages via Socket.IO, but for API test we'll check the forward endpoints exist
  // First let's check if messages can be created and if forward API routes are registered

  console.log('=== Test: Forward API Routes ===\n');

  // FW-API-001: GET /api/messages/forward/targets should return target list
  await test('FW-API-001', 'GET /api/messages/forward/targets returns targets', async () => {
    const r = await json('GET', '/api/messages/forward/targets', undefined, tokenA);
    assert(r.status === 200, `expected 200, got ${r.status}, body: ${JSON.stringify(r.data)}`);
    assert(r.data.conversations, 'missing conversations field');
    assert(Array.isArray(r.data.conversations), 'conversations not array');
    // Should include both convABId and convACId
    const convIds = r.data.conversations.map((c: any) => c._id);
    assert(convIds.includes(convABId), `missing conv A-B in targets`);
    assert(convIds.includes(convACId), `missing conv A-C in targets`);
  });

  // FW-API-002: GET /forward/targets without auth should 401
  await test('FW-API-002', 'GET /forward/targets without auth → 401', async () => {
    const r = await json('GET', '/api/messages/forward/targets');
    assert(r.status === 401, `expected 401, got ${r.status}`);
  });

  // FW-API-003: POST /forward with missing fields → 400
  await test('FW-API-003', 'POST /forward missing fields → 400', async () => {
    const r = await json('POST', '/api/messages/forward', {}, tokenA);
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });

  // FW-API-004: POST /forward with no targets → 400
  await test('FW-API-004', 'POST /forward no targets → 400', async () => {
    const r = await json('POST', '/api/messages/forward', {
      messageId: '000000000000000000000000',
      sourceType: 'conversation',
      targetConversationIds: [],
      targetChannelIds: [],
    }, tokenA);
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });

  // FW-API-005: POST /forward with non-existent message → 404
  await test('FW-API-005', 'POST /forward non-existent message → 404', async () => {
    const r = await json('POST', '/api/messages/forward', {
      messageId: '000000000000000000000000',
      sourceType: 'conversation',
      targetConversationIds: [convACId],
    }, tokenA);
    assert(r.status === 404, `expected 404, got ${r.status}`);
  });

  // FW-API-006: POST /forward/merge with missing messageIds → 400
  await test('FW-API-006', 'POST /forward/merge missing messageIds → 400', async () => {
    const r = await json('POST', '/api/messages/forward/merge', {}, tokenA);
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });

  // FW-API-007: POST /forward/merge with empty messageIds → 400
  await test('FW-API-007', 'POST /forward/merge empty array → 400', async () => {
    const r = await json('POST', '/api/messages/forward/merge', {
      messageIds: [],
      sourceType: 'conversation',
      targetConversationIds: [convACId],
    }, tokenA);
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });

  // FW-API-008: POST /forward/merge with non-existent messages → 404
  await test('FW-API-008', 'POST /forward/merge non-existent messages → 404', async () => {
    const r = await json('POST', '/api/messages/forward/merge', {
      messageIds: ['000000000000000000000000'],
      sourceType: 'conversation',
      targetConversationIds: [convACId],
    }, tokenA);
    assert(r.status === 404, `expected 404, got ${r.status}`);
  });

  // FW-API-009: User B targets check (B is only in conv A-B)
  await test('FW-API-009', 'User B targets only include own conversations', async () => {
    const r = await json('GET', '/api/messages/forward/targets', undefined, tokenB);
    assert(r.status === 200, `expected 200, got ${r.status}`);
    const convIds = r.data.conversations.map((c: any) => c._id);
    assert(convIds.includes(convABId), 'B should see conv A-B');
    assert(!convIds.includes(convACId), 'B should NOT see conv A-C');
  });

  // FW-API-010: Check forward targets response structure (has conversations.participants)
  await test('FW-API-010', 'Forward targets response has correct structure', async () => {
    const r = await json('GET', '/api/messages/forward/targets', undefined, tokenA);
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.data.conversations.length > 0, 'no conversations');
    const first = r.data.conversations[0];
    assert(first._id, 'missing _id');
    assert(typeof first.isGroup === 'boolean', 'missing isGroup');
    assert(Array.isArray(first.participants), 'missing participants array');
    if (first.participants.length > 0) {
      assert(first.participants[0]._id, 'participant missing _id');
      assert(first.participants[0].username, 'participant missing username');
    }
  });

  // FW-API-011: Check Message model supports forward type
  await test('FW-API-011', 'Message schema accepts forward type (check via route existence)', async () => {
    // Indirectly confirmed: if POST /forward route responds with 400 (not 404), schema is loaded
    const r = await json('POST', '/api/messages/forward', { messageId: 'x' }, tokenA);
    // Either 400 (bad input) or 500 (cast error) — not 404 (route not found)
    assert(r.status !== 404, `forward route not found (got ${r.status})`);
  });

  console.log(`\n📊 Results: ${pass} passed, ${fail} failed out of ${pass + fail} tests`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
