import pkg from './client/node_modules/socket.io-client/dist/socket.io.esm.min.js';
const { io } = pkg;

const BASE = 'http://localhost:3001';
const GPT_CONV_ID = '69ce638b8b5229e95c08ddb3';

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  return res.json();
}

async function login(username, password) {
  const res = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return res.token || res.data?.token;
}

function waitForEvents(socket, convId, timeout = 30000) {
  return new Promise((resolve) => {
    const chunks = [];
    let finalMsg = null;
    const timer = setTimeout(() => resolve({ chunks, finalMsg }), timeout);
    
    socket.on('gpt_stream_chunk', (data) => {
      if (data.conversationId === convId) chunks.push(data);
    });
    socket.on('receive_message', (data) => {
      const msg = data.message || data;
      if (msg.conversationId === convId && msg.sender?.username === 'GPT-5.2') {
        finalMsg = msg;
        clearTimeout(timer);
        setTimeout(() => resolve({ chunks, finalMsg }), 2000); // wait a bit more for chunks
      }
    });
  });
}

async function main() {
  console.log('=== TeamChat QA Tests ===\n');
  
  // Login
  const token = await login('testuser1', '123456');
  if (!token) { console.log('FAIL: Could not login'); process.exit(1); }
  console.log('Logged in, token obtained');

  // Get conversations
  const convRes = await api('/api/conversations', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const conversations = convRes.data || convRes;
  console.log(`Found ${conversations.length} conversations`);

  // Find non-GPT conversation
  let nonGptConv = conversations.find(c => {
    const participants = c.participants || [];
    return !participants.some(p => (p.username || p) === 'GPT-5.2');
  });

  if (!nonGptConv) {
    // Find testuser2 id
    const testuser2 = conversations.flatMap(c => c.participants || []).find(p => p.username === 'testuser2');
    if (testuser2) {
      const createRes = await api('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ participantIds: [testuser2._id] })
      });
      nonGptConv = createRes.data || createRes;
      console.log('Created new non-GPT conversation');
    } else {
      console.log('FAIL: Cannot find testuser2');
      process.exit(1);
    }
  }
  console.log(`Non-GPT conversation: ${nonGptConv._id}`);

  // Connect socket
  const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
  });
  console.log('Socket connected\n');

  // === TEST 1 ===
  console.log('--- Test 1: @GPT-5.2 global AI reply in non-GPT conversation ---');
  const wait1 = waitForEvents(socket, nonGptConv._id);
  
  const sendRes1 = await api('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ conversationId: nonGptConv._id, content: '@GPT-5.2 你好' })
  });
  console.log('Sent "@GPT-5.2 你好"');

  const result1 = await wait1;
  const hasChunks = result1.chunks.length > 0;
  const hasFinal = !!result1.finalMsg;
  const notError = hasFinal && !result1.finalMsg.content?.includes('抱歉');
  
  console.log(`  Streaming chunks received: ${result1.chunks.length}`);
  console.log(`  Final message received: ${hasFinal}`);
  if (hasFinal) console.log(`  Response preview: ${result1.finalMsg.content?.substring(0, 100)}`);
  console.log(`  Not error message: ${notError}`);
  const test1Pass = hasChunks && hasFinal && notError;
  console.log(`\n  TEST 1: ${test1Pass ? 'PASS ✅' : 'FAIL ❌'}\n`);

  // === TEST 2 ===
  console.log('--- Test 2: Dedicated GPT conversation (no @ needed) ---');
  const wait2 = waitForEvents(socket, GPT_CONV_ID);
  
  const sendRes2 = await api('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ conversationId: GPT_CONV_ID, content: '测试直接对话' })
  });
  console.log('Sent "测试直接对话" to dedicated GPT conversation');

  const result2 = await wait2;
  const hasChunks2 = result2.chunks.length > 0;
  const hasFinal2 = !!result2.finalMsg;
  const notError2 = hasFinal2 && !result2.finalMsg.content?.includes('抱歉');

  console.log(`  Streaming chunks received: ${result2.chunks.length}`);
  console.log(`  Final message received: ${hasFinal2}`);
  if (hasFinal2) console.log(`  Response preview: ${result2.finalMsg.content?.substring(0, 100)}`);
  console.log(`  Not error message: ${notError2}`);
  const test2Pass = hasChunks2 && hasFinal2 && notError2;
  console.log(`\n  TEST 2: ${test2Pass ? 'PASS ✅' : 'FAIL ❌'}\n`);

  // Summary
  console.log('=== SUMMARY ===');
  console.log(`Test 1 (@GPT-5.2 global reply): ${test1Pass ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Test 2 (Dedicated GPT conv):     ${test2Pass ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Overall: ${test1Pass && test2Pass ? 'ALL PASS ✅' : 'SOME FAILED ❌'}`);

  socket.disconnect();
  process.exit(test1Pass && test2Pass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
