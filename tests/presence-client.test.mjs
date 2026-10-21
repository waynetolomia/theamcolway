import assert from 'node:assert/strict';
import { PresenceClient, reconnectDelay, normalizePlayMode } from '../public/game/presence.js';
import { apiURL } from '../public/game/api-url.js';

let passed = 0;
const test = async (name, run) => { await run(); passed++; console.log(`PASS ${name}`); };
const SELF = 'SELF_1234567', PEER = 'PEER_1234567', OTHER = 'OTHER1234567';
const look = { gender: 'female', major: 'engine', hairStyle: 'bun', uniformBottom: 'skirt', outfit: 'coverall', body: 'regular', accessory: 'none', skin: '#b97850', hairColor: '#292327', accent: '#198879' };
const peerJoin = (k = PEER) => ({ type: 'join', k, name: 'Napat', look, major: 'engine', year: 2 });
const state = (k = PEER, extra = {}) => ({ k, x: 0, z: 0, yaw: 1.2, moving: true, running: false, ...extra });

function fixture({ local = false, page = 'https://college.example/game/index.html' } = {}) {
  let clock = 0, nextTimer = 0;
  const timers = new Map(), sockets = [], statuses = [], worldCalls = [], events = new Map();
  class FakeSocket {
    constructor(url) { this.url = url; this.readyState = 0; this.bufferedAmount = 0; this.sent = []; sockets.push(this); }
    open() { this.readyState = 1; this.onopen?.(); }
    receive(message) { this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) }); }
    send(raw) { this.sent.push({ at: clock, ...JSON.parse(raw) }); }
    close(code) { this.readyState = 3; this.closedCode = code; this.onclose?.({ code }); }
  }
  const world = {
    getPresenceState: () => ({ x: -5, z: 4, yaw: 0, moving: false, running: false }),
    ...Object.fromEntries(['clearRemotePlayers', 'addRemotePlayer', 'updateRemotePlayer', 'removeRemotePlayer', 'showRemoteBubble', 'playRemoteGesture', 'cancelRemoteGesture'].map(method => [method, (...args) => worldCalls.push({ method, args })])),
  };
  const client = new PresenceClient({
    WebSocket: FakeSocket, getWorld: () => world, isLocalMode: () => local,
    location: new URL(page), now: () => clock, onStatus: status => statuses.push(status),
    eventTarget: { addEventListener: (type, callback) => events.set(type, callback), removeEventListener: type => events.delete(type) },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: clock + delay, delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  function advance(ms) {
    const until = clock + ms;
    for (let i = 0; i < 10000; i++) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) { clock = until; return; }
      clock = next[1].at; timers.delete(next[0]); next[1].callback();
    }
    throw new Error('Timer loop');
  }
  function welcome(socket = sockets.at(-1), room = `public:${client.zone}:0`) {
    socket.open(); socket.receive({ type: 'welcome', you: SELF, room, count: 2 }); return socket;
  }
  function join(socket = sockets.at(-1)) {
    socket.receive(peerJoin()); socket.receive({ type: 'snapshot', t: clock + 1, players: [state()] });
  }
  return { client, sockets, statuses, timers, world, worldCalls, advance, welcome, join, events, clock: () => clock };
}

await test('Solo is the default and opens no presence connection or timers', () => {
  const f = fixture();
  assert.equal(f.client.mode, 'solo'); assert.equal(f.client.status.effectiveMode, 'solo');
  f.client.move({ x: 1, z: 2, yaw: 1, moving: true, running: false });
  f.client.setZone('dorm'); f.client.disconnect(); f.advance(60000);
  assert.equal(f.sockets.length, 0); assert.equal(f.timers.size, 0);
  assert.equal(normalizePlayMode('invalid'), 'solo'); assert.equal(normalizePlayMode('online'), 'online');
});

await test('browser-save beta refuses Online even when a caller requests it', () => {
  const f = fixture({ local: true });
  assert.equal(f.client.connect(), false); f.advance(60000);
  assert.equal(f.sockets.length, 0); assert.equal(f.client.mode, 'solo');
});

await test('Online uses a same-origin socket and sends hidden in the first hello', () => {
  const f = fixture(); f.client.connect({ hidden: true }); const socket = f.welcome();
  assert.equal(socket.url, 'wss://college.example/api/presence?zone=campus');
  assert.deepEqual(socket.sent[0], { at: 0, type: 'hello', mode: 'online', hidden: true });
  assert.equal(f.client.status.state, 'online'); assert.equal(f.client.status.hidden, true);
  f.client.setHidden(false); assert.deepEqual(socket.sent.at(-1), { at: 0, type: 'hide', hidden: false });
  f.client.disconnect(); assert.equal(socket.readyState, 3); assert.equal(f.client.status.state, 'solo');
});

await test('reconnect uses 1, 2, 4, 8, 16, 30 second backoff and resets after welcome', () => {
  const f = fixture(); f.client.connect();
  for (const delay of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
    const oldCount = f.sockets.length;
    f.sockets.at(-1).close();
    assert.equal(f.client.status.state, 'reconnecting'); assert.equal(f.client.status.effectiveMode, 'solo');
    f.advance(delay - 1); assert.equal(f.sockets.length, oldCount);
    f.advance(1); assert.equal(f.sockets.length, oldCount + 1);
  }
  f.welcome().close(); assert.equal([...f.timers.values()][0].delay, 1000);
  assert.equal(reconnectDelay(100), 30000);
  f.client.disconnect(); f.advance(60000); assert.equal(f.timers.size, 0);
});

await test('a socket that never welcomes times out and cannot hold up the game', () => {
  const f = fixture(); f.client.connect(); f.sockets[0].open();
  f.advance(9999); assert.equal(f.client.status.state, 'connecting');
  f.advance(1); assert.equal(f.client.status.state, 'reconnecting');
  assert.equal(f.client.mode, 'online'); assert.equal(f.client.status.effectiveMode, 'solo');
  assert.equal(f.sockets[0].readyState, 3);
});

await test('browser offline/online events fall back immediately and never activate Solo', () => {
  const f = fixture();
  f.events.get('offline')(); f.events.get('online')(); assert.equal(f.sockets.length, 0);
  f.client.connect(); f.welcome(); f.join();
  f.events.get('offline')();
  assert.equal(f.client.status.state, 'reconnecting'); assert.equal(f.client.active.size, 0);
  f.advance(60000); assert.equal(f.sockets.length, 1, 'Known offline state does not open doomed sockets');
  f.events.get('online')(); assert.equal(f.sockets.length, 2); f.welcome();
  assert.equal(f.client.status.state, 'online');
  f.client.destroy(); assert.equal(f.events.size, 0);
});

await test('closed class stays private with no retries until an explicit choice', () => {
  const f = fixture(); f.client.connect({ code: 'ABC-234' }); f.welcome(f.sockets[0], 'class:ABC-234:campus:0');
  f.sockets[0].close(4003);
  assert.equal(f.client.status.state, 'class-closed'); assert.equal(f.client.status.effectiveMode, 'solo');
  assert.equal(f.client.code, 'ABC-234'); assert.equal(f.timers.size, 0);
  f.events.get('offline')(); f.events.get('online')(); f.client.setZone('dorm'); f.advance(60000);
  assert.equal(f.sockets.length, 1); assert.equal(f.client.code, 'ABC-234');
  f.client.retry(); assert.equal(f.sockets.length, 2); assert.match(f.sockets[1].url, /code=ABC-234/);
  f.welcome(f.sockets[1], 'class:ABC-234:dorm:0'); f.sockets[1].close(4003);
  f.client.setClassCode(''); assert.equal(f.sockets.length, 3); assert.ok(!f.sockets[2].url.includes('code='));
});

await test('disconnect clears remote actors without changing the world or progress', () => {
  const f = fixture(); f.client.connect(); f.welcome(); f.join();
  assert.equal(f.client.active.size, 1);
  f.worldCalls.length = 0; f.sockets[0].close();
  assert.equal(f.client.active.size, 0);
  assert.deepEqual(f.worldCalls.map(call => call.method), ['clearRemotePlayers']);
  assert.equal(f.client.status.effectiveMode, 'solo');
});

await test('zone and class switches ignore old socket callbacks and reconnect once', () => {
  const f = fixture(); f.client.connect(); const old = f.welcome(); f.join();
  const staleMessage = old.onmessage, staleClose = old.onclose;
  f.client.setZone('dorm');
  assert.equal(f.sockets.length, 2); assert.equal(f.client.active.size, 0);
  staleMessage({ data: JSON.stringify(peerJoin(OTHER)) }); staleClose();
  assert.equal(f.client.players.size, 0); assert.equal(f.sockets.length, 2);
  f.welcome(); f.client.setClassCode('abc234');
  assert.equal(f.sockets.length, 3); assert.match(f.sockets.at(-1).url, /zone=dorm&code=ABC-234$/);
  f.welcome(f.sockets.at(-1), 'class:ABC-234:dorm:0');
  f.client.connect(); assert.equal(f.sockets.length, 3, 'Repeated connect is idempotent');
  assert.equal(f.client.setClassCode('IOO-001'), false); assert.equal(f.sockets.length, 3);
  f.client.setClassCode(''); assert.equal(f.sockets.length, 4);
});

await test('server frames are validated; metadata is cached while leaving interest', () => {
  const f = fixture(); f.client.connect(); const socket = f.welcome();
  for (const raw of ['not json', 'x'.repeat(5000), JSON.stringify({ type: 'say', k: PEER, phraseId: 'free text' }), JSON.stringify({ ...peerJoin(), email: 'private@example.com' })]) socket.receive(raw);
  assert.equal(f.client.players.size, 0); assert.equal(f.client.active.size, 0);
  f.join(); assert.equal(f.client.getPlayer(PEER).label, 'Napat · ENGINE · Y2');
  socket.receive({ type: 'snapshot', t: 2, players: [] });
  assert.equal(f.client.active.size, 0); assert.equal(f.client.players.size, 1);
  socket.receive({ type: 'snapshot', t: 3, players: [state()] });
  assert.equal(f.client.active.size, 1);
  socket.receive({ type: 'snapshot', t: 2, players: [] });
  assert.equal(f.client.active.size, 1, 'An out-of-order snapshot does not rewind avatars');
  socket.receive({ type: 'leave', k: PEER }); assert.equal(f.client.players.size, 0);
});

await test('mute hides bubbles and emotes for the session; reporting sends only a key', () => {
  const f = fixture(); f.client.connect(); const socket = f.welcome(); f.join();
  socket.receive({ type: 'say', k: PEER, phraseId: 'roger' });
  assert.equal(f.worldCalls.at(-1).args[1], 'Roger.');
  assert.equal(f.client.mute(PEER), true);
  assert.deepEqual(f.worldCalls.slice(-2).map(call => call.method), ['showRemoteBubble', 'cancelRemoteGesture']);
  const calls = f.worldCalls.length;
  socket.receive({ type: 'say', k: PEER, phraseId: 'hello' }); socket.receive({ type: 'emote', k: PEER, id: 'wave' });
  assert.equal(f.worldCalls.length, calls); assert.equal(f.client.isMuted(PEER), true);
  assert.equal(f.client.report(PEER), true);
  assert.deepEqual(socket.sent.at(-1), { at: 0, type: 'report', userKey: PEER });
  assert.equal(f.client.report('someone@example.com'), false);
});

await test('moves are coalesced at 8 per second with exactly one final stopped update', () => {
  const f = fixture(); f.client.connect(); const socket = f.welcome();
  for (let i = 1; i <= 60; i++) {
    f.advance(16); f.client.move({ x: -5 + i / 10, z: 4, yaw: i / 100, moving: true, running: false });
  }
  f.client.move({ x: 1, z: 4, yaw: .6, moving: false, running: false });
  f.advance(125);
  const moves = socket.sent.filter(message => message.type === 'move');
  for (let i = 1; i < moves.length; i++) assert.ok(moves[i].at - moves[i - 1].at >= 125);
  assert.equal(moves.at(-1).moving, false); assert.equal(moves.at(-1).x, 1);
  const count = moves.length;
  for (let i = 0; i < 20; i++) { f.advance(100); f.client.move({ x: 1, z: 4, yaw: .6, moving: false, running: false }); }
  assert.equal(socket.sent.filter(message => message.type === 'move').length, count);
  f.client.move({ x: 1, z: 4, yaw: .9, moving: false, running: false });
  assert.equal(socket.sent.at(-1).yaw, .9, 'Turning in place sends a change');
});

await test('invalid social IDs are rejected and a shared two-second cooldown applies', () => {
  const f = fixture(); f.client.connect(); f.welcome();
  assert.equal(f.client.say('a custom message'), false); assert.equal(f.client.sendEmote('dance'), false);
  assert.equal(f.client.say('hello'), true); assert.equal(f.client.sendEmote('wave'), false);
  f.advance(2000); assert.equal(f.client.sendEmote('thumbs-up'), true);
  f.advance(2000); f.client.setHidden(true); assert.equal(f.client.say('roger'), false);
  assert.equal(f.client.sendEmote('wave'), false);
  f.client.disconnect(); assert.equal(f.client.say('roger'), false);
});

await test('development identity forwarding is restricted to exact local hosts and game APIs', () => {
  for (const host of ['localhost:8787', '127.0.0.1:8787', '[::1]:8787']) {
    const page = new URL(`http://${host}/game/index.html?dev_user=cadet-a`);
    assert.equal(apiURL('/api/academy', page), '/api/academy?dev_user=cadet-a');
    assert.equal(apiURL('/api/presence?zone=dorm', page), '/api/presence?zone=dorm&dev_user=cadet-a');
    assert.equal(apiURL('/api/class-worlds', page), '/api/class-worlds?dev_user=cadet-a');
    assert.equal(apiURL('/api/other', page), '/api/other');
    assert.equal(apiURL('https://elsewhere.example/api/academy', page), 'https://elsewhere.example/api/academy');
  }
  assert.equal(apiURL('/api/academy', new URL('https://college.example/game/?dev_user=cadet-a')), '/api/academy');
  assert.equal(apiURL('/api/academy', new URL('http://localhost.evil.test/?dev_user=cadet-a')), '/api/academy');
  assert.equal(apiURL('/api/academy', new URL('http://localhost/?dev_user=bad%40name')), '/api/academy');
  const f = fixture({ page: 'http://127.0.0.1:8787/game/index.html?dev_user=cadet-b' }); f.client.connect();
  assert.match(f.sockets[0].url, /dev_user=cadet-b/);
});

console.log(`\n${passed} presence client checks passed.`);
