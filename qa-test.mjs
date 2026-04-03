
import pkg from './client/node_modules/socket.io-client/dist/socket.io.esm.min.js';
const { io } = pkg;

const BASE = 'http://localhost:3001';

async function login(username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  return data.token;
}

async function api(method, path, token, body) {
  const opts = { method, headers: { 'Authorization': `Bearer ${token}` } };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(`${BASE}${path}`, opts);
  return { status: res.status, data: await res.json().catch(() => null) };
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('socket timeout')), 5000);
  });
}

function waitForGPTReply(socket, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let fullMsg = null;
    const timer = setTimeout(() => {
      resolve({ chunks, fullMsg, timedOut: true });
    }, timeoutMs);
    socket.on('gpt_stream_chunk', (d) => { chunks.push(d); });
    socket.on('receive_message', (msg) => {
      if (msg.sender?.username === 'GPT-5.2' || msg.senderName === 'GPT-5.2' || msg.isBot) {
        fullMsg = msg;
        clearTimeout(timer);
        setTimeout(() => resolve({ chunks, fullMsg, timedOut: false }), 2000); // wait for more chunks
      }
    });
  });
}

async function test1() {
  console.log('\n=== Test 1: @GPT-5.2 in non-GPT conversation ===');
  try {
    const token = await login('testuser1', '123456');
    const { data: convos } = await api('GET', '/api/conversations', token);
    let targetConvo = convos?.find(c => c._id !== '69ce638b8b5229e95c08ddb3' && !c.isGPT);
    
    if (!targetConvo) {
      // Create conversation with testuser2
      const { data: users } = await api('GET', '/api/users', token);
      const tu2 = users.find(u => u.username === 'testuser2');
      if (tu2) {
        const { data: newConvo } = await api('POST', '/api/conversations', token, { participantId: tu2._id || tu2.id });
        targetConvo = newConvo;
      }
    }
    
    if (!targetConvo) {
      console.log('FAIL - Could not find/create non-GPT conversation');
      return false;
    }
    
    const convoId = targetConvo._id || targetConvo.id;
    console.log(`Using conversation: ${convoId}`);
    
    const socket = await connectSocket(token);
    const replyPromise = waitForGPTReply(socket);
    
    socket.emit('send_message', { conversationId: convoId, content: '@GPT-5.2 你好吗' });
    
    const result = await replyPromise;
    socket.disconnect();
    
    if (result.timedOut && result.chunks.length === 0) {
      console.log('FAIL - No GPT response received (timeout)');
      return false;
    }
    
    const content = result.fullMsg?.content || result.chunks.map(c => c.chunk || c.content || '').join('');
    console.log(`GPT replied: "${content.substring(0, 100)}..."`);
    console.log(`Chunks received: ${result.chunks.length}`);
    console.log('PASS');
    return true;
  } catch (e) {
    console.log(`FAIL - ${e.message}`);
    return false;
  }
}

async function test2() {
  console.log('\n=== Test 2: Dedicated GPT conversation without @ ===');
  try {
    const token = await login('testuser1', '123456');
    const socket = await connectSocket(token);
    const replyPromise = waitForGPTReply(socket);
    
    socket.emit('send_message', { conversationId: '69ce638b8b5229e95c08ddb3', content: '直接测试' });
    
    const result = await replyPromise;
    socket.disconnect();
    
    if (result.timedOut && result.chunks.length === 0) {
      console.log('FAIL - No GPT response received (timeout)');
      return false;
    }
    
    const content = result.fullMsg?.content || result.chunks.map(c => c.chunk || c.content || '').join('');
    console.log(`GPT replied: "${content.substring(0, 100)}..."`);
    console.log('PASS');
    return true;
  } catch (e) {
    console.log(`FAIL - ${e.message}`);
    return false;
  }
}

async function test3() {
  console.log('\n=== Test 3: Contact visibility - admin hide/unhide ===');
  try {
    const adminToken = await login('zhenyuduan', '123456');
    const { status: adminStatus, data: allUsers } = await api('GET', '/api/admin/users', adminToken);
    if (adminStatus !== 200) { console.log(`FAIL - admin/users returned ${adminStatus}`); return false; }
    
    const tu1 = allUsers.find(u => u.username === 'testuser1');
    const tu2 = allUsers.find(u => u.username === 'testuser2');
    if (!tu1 || !tu2) { console.log('FAIL - testuser1 or testuser2 not found'); return false; }
    
    const tu1Id = tu1.id || tu1._id;
    const tu2Id = tu2.id || tu2._id;
    console.log(`testuser1 id: ${tu1Id}, testuser2 id: ${tu2Id}`);
    
    // Hide testuser2 from testuser1
    const { status: hideStatus } = await api('PUT', `/api/admin/visibility/${tu1Id}`, adminToken, { hiddenUsers: [tu2Id] });
    console.log(`Hide PUT status: ${hideStatus}`);
    if (hideStatus !== 200) { console.log('FAIL - hide request failed'); return false; }
    
    // Check testuser1 sees
    const tu1Token = await login('testuser1', '123456');
    const { data: visibleUsers } = await api('GET', '/api/users', tu1Token);
    
    const seesTestuser2 = visibleUsers.some(u => u.username === 'testuser2');
    const seesGPT = visibleUsers.some(u => u.username === 'GPT-5.2' || u.isBot);
    
    console.log(`testuser1 sees testuser2: ${seesTestuser2} (expected: false)`);
    console.log(`testuser1 sees GPT-5.2: ${seesGPT} (expected: true)`);
    
    if (seesTestuser2) { console.log('FAIL - testuser2 still visible'); }
    if (!seesGPT) { console.log('FAIL - GPT-5.2 not visible'); }
    
    // Cleanup
    const { status: unhideStatus } = await api('PUT', `/api/admin/visibility/${tu1Id}`, adminToken, { hiddenUsers: [] });
    console.log(`Unhide PUT status: ${unhideStatus}`);
    
    const { data: afterUsers } = await api('GET', '/api/users', tu1Token);
    const seesAgain = afterUsers.some(u => u.username === 'testuser2');
    console.log(`After cleanup, testuser1 sees testuser2: ${seesAgain} (expected: true)`);
    
    const pass = !seesTestuser2 && seesGPT && seesAgain;
    console.log(pass ? 'PASS' : 'FAIL');
    return pass;
  } catch (e) {
    console.log(`FAIL - ${e.message}`);
    return false;
  }
}

async function test4() {
  console.log('\n=== Test 4: Admin access control ===');
  try {
    const token = await login('testuser1', '123456');
    const { status: s1 } = await api('GET', '/api/admin/users', token);
    const { status: s2 } = await api('PUT', '/api/admin/visibility/someid', token, { hiddenUsers: [] });
    
    console.log(`GET /api/admin/users as testuser1: ${s1} (expected: 403)`);
    console.log(`PUT /api/admin/visibility as testuser1: ${s2} (expected: 403)`);
    
    const pass = s1 === 403 && s2 === 403;
    console.log(pass ? 'PASS' : 'FAIL');
    return pass;
  } catch (e) {
    console.log(`FAIL - ${e.message}`);
    return false;
  }
}

// Run all
const results = [];
results.push(await test1());
results.push(await test2());
results.push(await test3());
results.push(await test4());

console.log('\n========== SUMMARY ==========');
const labels = ['Test 1 (@GPT-5.2 global mention)', 'Test 2 (Dedicated GPT convo)', 'Test 3 (Contact visibility)', 'Test 4 (Admin access control)'];
results.forEach((r, i) => console.log(`${labels[i]}: ${r ? 'PASS ✅' : 'FAIL ❌'}`));
console.log(`\nOverall: ${results.every(r => r) ? 'ALL PASS ✅' : 'SOME FAILED ❌'} (${results.filter(r=>r).length}/${results.length})`);
process.exit(results.every(r=>r) ? 0 : 1);
