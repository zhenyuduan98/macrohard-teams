const http = require('http');
const BASE = 'http://localhost:3001';

function request(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: {} };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) opts.headers['Content-Type'] = 'application/json';
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { let p; try { p = JSON.parse(data); } catch { p = data; } resolve({ status: res.statusCode, data: p }); });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login(u, p) {
  const { status, data } = await request('POST', '/api/auth/login', null, { username: u, password: p });
  if (status !== 200) throw new Error(`Login failed ${u}: ${status}`);
  return data.token;
}

async function getIO() {
  const r = require('module').createRequire(__filename);
  const sio = r('./client/node_modules/socket.io-client');
  return sio.io || sio.default || sio;
}

async function connectSocket(ioFn, token) {
  return new Promise((resolve, reject) => {
    const socket = ioFn(BASE, { auth: { token }, transports: ['websocket'] });
    socket.onAny((event, ...args) => { console.log(`  [socket event] ${event}`, typeof args[0] === 'object' ? JSON.stringify(args[0]).substring(0, 150) : args[0]); });
    socket.on('connect', () => { console.log('  Socket connected:', socket.id); resolve(socket); });
    socket.on('connect_error', (e) => { console.log('  Socket connect error:', e.message); reject(e); });
    setTimeout(() => reject(new Error('socket timeout')), 8000);
  });
}

function waitForGPT(socket, ms = 30000) {
  return new Promise((resolve) => {
    let chunks = [], fullMsg = null, done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve({ chunks, fullMsg, timedOut: true }); } }, ms);
    socket.on('gpt_stream_chunk', d => { chunks.push(d); if (d.done && !done) { clearTimeout(t); setTimeout(() => { done = true; resolve({ chunks, fullMsg, timedOut: false }); }, 1000); } });
    socket.on('receive_message', msg => {
      const name = msg.sender?.username || '';
      if (name === 'GPT-5.2') { fullMsg = msg; }
    });
  });
}

async function main() {
  const ioFn = await getIO();

  // Test 1
  console.log('\n=== Test 1: @GPT-5.2 in non-GPT conversation ===');
  let t1 = false;
  try {
    const token = await login('testuser1', '123456');
    const { data: convos } = await request('GET', '/api/conversations', token);
    let target = Array.isArray(convos) ? convos.find(c => (c._id||c.id) !== '69ce638b8b5229e95c08ddb3') : null;
    if (!target) {
      const { data: users } = await request('GET', '/api/users', token);
      const tu2 = users.find(u => u.username === 'testuser2');
      if (tu2) { const r = await request('POST', '/api/conversations', token, { participantId: tu2._id || tu2.id }); target = r.data; }
    }
    const cid = target._id || target.id;
    console.log(`Conv: ${cid}`);
    const sock = await connectSocket(ioFn, token);
    // Also join conversation explicitly
    sock.emit('join_conversation', { conversationId: cid });
    await new Promise(r => setTimeout(r, 500));
    const p = waitForGPT(sock);
    sock.emit('send_message', { conversationId: cid, content: '@GPT-5.2 你好吗' });
    const res = await p;
    sock.disconnect();
    if (res.timedOut && !res.chunks.length) { console.log('FAIL - no response'); }
    else { const c = res.fullMsg?.content || res.chunks.map(x=>x.content||'').join(''); console.log(`Reply: "${c.substring(0,120)}"`); console.log('PASS'); t1 = true; }
  } catch(e) { console.log(`FAIL - ${e.message}`); }

  // Test 2
  console.log('\n=== Test 2: Dedicated GPT conv without @ ===');
  let t2 = false;
  try {
    const token = await login('testuser1', '123456');
    const sock = await connectSocket(ioFn, token);
    sock.emit('join_conversation', { conversationId: '69ce638b8b5229e95c08ddb3' });
    await new Promise(r => setTimeout(r, 500));
    const p = waitForGPT(sock);
    sock.emit('send_message', { conversationId: '69ce638b8b5229e95c08ddb3', content: '直接测试' });
    const res = await p;
    sock.disconnect();
    if (res.timedOut && !res.chunks.length) { console.log('FAIL - no response'); }
    else { const c = res.fullMsg?.content || res.chunks.map(x=>x.content||'').join(''); console.log(`Reply: "${c.substring(0,120)}"`); console.log('PASS'); t2 = true; }
  } catch(e) { console.log(`FAIL - ${e.message}`); }

  // Test 3
  console.log('\n=== Test 3: Contact visibility ===');
  let t3 = false;
  try {
    const at = await login('zhenyuduan', '123456');
    const { data: au } = await request('GET', '/api/admin/users', at);
    const tu1 = au.find(u => u.username === 'testuser1'), tu2 = au.find(u => u.username === 'testuser2');
    const t1id = tu1.id||tu1._id, t2id = tu2.id||tu2._id;
    await request('PUT', `/api/admin/visibility/${t1id}`, at, { hiddenUsers: [t2id] });
    const ut = await login('testuser1', '123456');
    const { data: vu } = await request('GET', '/api/users', ut);
    const st2 = vu.some(u=>u.username==='testuser2'), sg = vu.some(u=>u.username==='GPT-5.2'||u.isBot);
    console.log(`sees t2: ${st2}(want F), sees GPT: ${sg}(want T)`);
    await request('PUT', `/api/admin/visibility/${t1id}`, at, { hiddenUsers: [] });
    const { data: au2 } = await request('GET', '/api/users', ut);
    const sa = au2.some(u=>u.username==='testuser2');
    console.log(`cleanup sees t2: ${sa}(want T)`);
    t3 = !st2 && sg && sa;
    console.log(t3 ? 'PASS' : 'FAIL');
  } catch(e) { console.log(`FAIL - ${e.message}`); }

  // Test 4
  console.log('\n=== Test 4: Admin access control ===');
  let t4 = false;
  try {
    const tk = await login('testuser1', '123456');
    const { status: s1 } = await request('GET', '/api/admin/users', tk);
    const { status: s2 } = await request('PUT', '/api/admin/visibility/fakeid', tk, { hiddenUsers: [] });
    console.log(`GET:${s1}(want 403) PUT:${s2}(want 403)`);
    t4 = s1===403 && s2===403;
    console.log(t4 ? 'PASS' : 'FAIL');
  } catch(e) { console.log(`FAIL - ${e.message}`); }

  console.log('\n=== SUMMARY ===');
  const r = [t1,t2,t3,t4], l = ['@GPT-5.2 mention','Dedicated GPT','Visibility','Admin ACL'];
  r.forEach((v,i) => console.log(`${l[i]}: ${v?'PASS ✅':'FAIL ❌'}`));
  console.log(`Overall: ${r.filter(v=>v).length}/${r.length} ${r.every(v=>v)?'ALL PASS ✅':'SOME FAILED ❌'}`);
  process.exit(r.every(v=>v)?0:1);
}
main().catch(e=>{console.error(e);process.exit(1)});
