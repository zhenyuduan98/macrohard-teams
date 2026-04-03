const http = require('http');
const https = require('https');

const BASE = 'http://localhost:3001';
const GPT_CONV_ID = '69ce638b8b5229e95c08ddb3';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: {} };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) { opts.headers['Content-Type'] = 'application/json'; }
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve(data); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Dynamically import socket.io-client
  const { io } = require('./client/node_modules/socket.io-client/build/cjs/index.js');
  
  console.log('=== TeamChat QA Tests ===\n');

  // Login
  const loginRes = await request('POST', '/api/auth/login', { username: 'testuser1', password: '123456' });
  const token = loginRes.token || loginRes.data?.token;
  if (!token) { console.log('FAIL: Could not login', loginRes); process.exit(1); }
  console.log('Logged in');

  // Get conversations
  const convRes = await request('GET', '/api/conversations', null, token);
  const conversations = convRes.data || convRes;
  console.log(`Found ${conversations.length} conversations`);

  // Find non-GPT conversation
  let nonGptConv = conversations.find(c => {
    const parts = c.participants || [];
    return !parts.some(p => (p.username || p) === 'GPT-5.2');
  });

  if (!nonGptConv) {
    // Find testuser2 id from any conversation
    let testuser2Id;
    for (const c of conversations) {
      const p = (c.participants || []).find(p => p.username === 'testuser2');
      if (p) { testuser2Id = p._id; break; }
    }
    if (!testuser2Id) {
      // Try to search users
      const users = await request('GET', '/api/users', null, token);
      const u2 = (users.data || users || []).find(u => u.username === 'testuser2');
      if (u2) testuser2Id = u2._id;
    }
    if (testuser2Id) {
      const cr = await request('POST', '/api/conversations', { participantIds: [testuser2Id] }, token);
      nonGptConv = cr.data || cr;
      console.log('Created non-GPT conversation');
    } else {
      console.log('FAIL: Cannot find testuser2');
      process.exit(1);
    }
  }
  console.log(`Non-GPT conversation: ${nonGptConv._id}`);
  
  // Find GPT conversation
  const gptConv = conversations.find(c => c._id === GPT_CONV_ID);
  console.log(`GPT conversation found: ${!!gptConv}`);

  // Connect socket
  const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', (e) => { console.error('Socket connect error:', e.message); reject(e); });
  });
  console.log('Socket connected\n');

  // Helper
  function waitForGPT(convId, timeout = 30000) {
    return new Promise((resolve) => {
      const chunks = [];
      let finalMsg = null;
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; resolve({ chunks, finalMsg }); } }, timeout);
      
      const onChunk = (data) => {
        if (data.conversationId === convId) chunks.push(data);
      };
      const onMsg = (data) => {
        const msg = data.message || data;
        if ((msg.conversationId === convId || msg.conversation === convId) && 
            (msg.sender?.username === 'GPT-5.2' || msg.senderName === 'GPT-5.2')) {
          finalMsg = msg;
          if (!done) {
            done = true;
            clearTimeout(timer);
            // Wait a bit more for remaining chunks
            setTimeout(() => {
              socket.off('gpt_stream_chunk', onChunk);
              socket.off('receive_message', onMsg);
              resolve({ chunks, finalMsg });
            }, 2000);
          }
        }
      };
      socket.on('gpt_stream_chunk', onChunk);
      socket.on('receive_message', onMsg);
    });
  }

  // === TEST 1 ===
  console.log('--- Test 1: @GPT-5.2 global AI reply in non-GPT conversation ---');
  const wait1 = waitForGPT(nonGptConv._id);
  await request('POST', '/api/messages', { conversationId: nonGptConv._id, content: '@GPT-5.2 你好' }, token);
  console.log('Sent "@GPT-5.2 你好"');

  const r1 = await wait1;
  const t1chunks = r1.chunks.length > 0;
  const t1final = !!r1.finalMsg;
  const t1content = r1.finalMsg?.content || '';
  const t1notErr = t1final && !t1content.startsWith('抱歉');
  console.log(`  Chunks: ${r1.chunks.length}`);
  console.log(`  Final msg: ${t1final}`);
  if (t1final) console.log(`  Preview: ${t1content.substring(0, 120)}`);
  console.log(`  Not error: ${t1notErr}`);
  const test1 = t1chunks && t1final && t1notErr;
  console.log(`\n  TEST 1: ${test1 ? 'PASS ✅' : 'FAIL ❌'}\n`);

  // === TEST 2 ===
  console.log('--- Test 2: Dedicated GPT conversation (no @ needed) ---');
  const wait2 = waitForGPT(GPT_CONV_ID);
  await request('POST', '/api/messages', { conversationId: GPT_CONV_ID, content: '测试直接对话' }, token);
  console.log('Sent "测试直接对话"');

  const r2 = await wait2;
  const t2chunks = r2.chunks.length > 0;
  const t2final = !!r2.finalMsg;
  const t2content = r2.finalMsg?.content || '';
  const t2notErr = t2final && !t2content.startsWith('抱歉');
  console.log(`  Chunks: ${r2.chunks.length}`);
  console.log(`  Final msg: ${t2final}`);
  if (t2final) console.log(`  Preview: ${t2content.substring(0, 120)}`);
  console.log(`  Not error: ${t2notErr}`);
  const test2 = t2chunks && t2final && t2notErr;
  console.log(`\n  TEST 2: ${test2 ? 'PASS ✅' : 'FAIL ❌'}\n`);

  // Summary
  console.log('=== SUMMARY ===');
  console.log(`Test 1 (@GPT-5.2 in non-GPT conv): ${test1 ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Test 2 (Dedicated GPT conv):        ${test2 ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Overall: ${test1 && test2 ? 'ALL PASS ✅' : 'SOME FAILED ❌'}`);

  socket.disconnect();
  process.exit(test1 && test2 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
