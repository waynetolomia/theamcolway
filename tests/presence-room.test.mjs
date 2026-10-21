import assert from 'node:assert/strict';
import {
  PresenceRoom, joinPresenceRoom, closeClassRooms, PRESENCE_ROOM_HEADER, PRESENCE_USER_HEADER, nearbyPlayers,
} from '../src/presence-room.mjs';
import {
  QUICK_CHAT, EMOTES, MAX_ROOM_INSTANCES, MAX_SERVER_MESSAGE_BYTES, ZONE_CONFIG, clampMovement, normalizeClassCode,
  roomName, utf8ByteLength, validateClientMessage, validateServerMessage,
} from '../public/game/presence-protocol.js';
import {
  loadPresenceProfile, createClassWorld, listClassWorlds, requireOpenClassWorld, closeClassWorld,
} from '../lib/presence-store.mjs';
import { sqliteD1 } from './sqlite-d1.mjs';

let passed = 0;
async function test(name, work) { await work(); passed++; console.log(`PASS ${name}`); }
const NOW = Date.parse('2026-10-21T09:00:00Z');
const k = number => `key${String(number).padStart(9, '0')}`;

class Clock {
  time = NOW;
  next = 0;
  timers = new Map();
  pending = new Set();
  now = () => this.time;
  track = promise => {
    this.pending.add(promise);
    promise.finally(() => this.pending.delete(promise));
    return promise;
  };
  async settle() { while (this.pending.size) await Promise.all([...this.pending]); }
  setTimeout = (callback, delay) => {
    const id = ++this.next;
    this.timers.set(id, { callback, at: this.time + delay });
    return id;
  };
  clearTimeout = id => this.timers.delete(id);
  advance(ms) {
    const target = this.time + ms;
    while (true) {
      const next = [...this.timers].filter(([, item]) => item.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.time = next[1].at;
      this.timers.delete(next[0]);
      const work = next[1].callback();
      if (work?.then) this.track(work);
    }
    this.time = target;
  }
}

class Socket {
  messages = [];
  readyState = 1;
  attachment = null;
  send(raw) {
    assert.equal(this.readyState, 1);
    assert.ok(utf8ByteLength(raw) < MAX_SERVER_MESSAGE_BYTES, 'every outgoing frame is below 4 KiB');
    assert.ok(validateServerMessage(raw), `server emitted a valid frame: ${raw.slice(0, 100)}`);
    this.messages.push(raw);
  }
  close(code, reason) { this.readyState = 3; this.closeCode = code; this.closeReason = reason; }
  serializeAttachment(value) {
    this.attachment = structuredClone(value);
    assert.ok(utf8ByteLength(JSON.stringify(this.attachment)) < 16_384, 'hibernation attachment stays within the documented limit');
  }
  deserializeAttachment() { return structuredClone(this.attachment); }
  frames(type) { return this.messages.map(raw => JSON.parse(raw)).filter(frame => !type || frame.type === type); }
}

function harness() {
  const DB = sqliteD1(), clock = new Clock(), rooms = new Map(), requests = [];
  let keyCounter = 0;
  const runtime = {
    now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    createPair() { const server = new Socket(); return [{ server }, server]; },
    upgradeResponse: client => ({ status: 101, headers: new Headers(), webSocket: client }),
    makeKey: () => k(++keyCounter),
  };
  const env = { DB, PRESENCE_ROOMS: {
    idFromName: name => name,
    get(name) { return { fetch: request => {
      requests.push({ name, request });
      return getRoom(name).room.fetch(request);
    } }; },
  } };
  function getRoom(name = 'public:campus:0') {
    if (!rooms.has(name)) {
      const sockets = [];
      const ctx = { getWebSockets: () => sockets.filter(socket => socket.readyState === 1), acceptWebSocket: socket => sockets.push(socket), waitUntil: clock.track };
      rooms.set(name, { ctx, room: new PresenceRoom(ctx, env, runtime) });
    }
    return rooms.get(name);
  }
  async function seed(userId, profile = {}, semester = 1) {
    const document = JSON.stringify({ untouched: 'progress marker', journey: {
      initialized: true, semester, profile: { name: `Napat ${userId}`, ...profile }, results: {},
    } });
    await DB.prepare('INSERT OR REPLACE INTO academy_accounts (user_id, revision, document, updated_at) VALUES (?, 0, ?, ?)')
      .bind(userId, document, new Date(NOW).toISOString()).run();
    return document;
  }
  async function connect(userId, { zone = 'campus', code = null, hello = true, hidden = false } = {}) {
    const response = await joinPresenceRoom(env, { userId, zone, code });
    if (response.status !== 101) return { response };
    const ws = response.webSocket.server, welcome = ws.frames('welcome')[0];
    const room = getRoom(welcome.room).room;
    if (hello) await room.webSocketMessage(ws, JSON.stringify({ type: 'hello', mode: 'online', hidden }));
    return { response, ws, room, key: welcome.you, name: welcome.room };
  }
  return { DB, clock, rooms, requests, env, runtime, getRoom, seed, connect,
    async message(client, message) {
      return getRoom(client.name).room.webSocketMessage(client.ws, typeof message === 'string' ? message : JSON.stringify(message));
    },
    hibernate(name = 'public:campus:0') {
      assert.equal(clock.timers.size, 0, 'the room is clean before hibernation');
      const holder = getRoom(name);
      holder.room = new PresenceRoom(holder.ctx, env, runtime);
      return holder.room;
    },
    close() {
      for (const holder of rooms.values()) for (const socket of [...holder.room.sessions.keys()]) holder.room.webSocketClose(socket);
      DB.close();
    },
  };
}

const move = (x = 0, z = 0, extra = {}) => ({ type: 'move', x, z, yaw: 0, moving: true, running: false, ...extra });

await test('shared protocol validates every type, fixed vocabulary, exact shapes and directional byte limits', async () => {
  assert.equal(QUICK_CHAT.length, 12);
  assert.deepEqual(EMOTES, ['wave', 'salute', 'thumbs-up', 'cheer']);
  for (const value of [
    { type: 'hello', mode: 'online', hidden: false }, move(), { type: 'hide', hidden: true },
    { type: 'emote', id: 'wave' }, { type: 'say', phraseId: 'roger' }, { type: 'mute', userKey: k(2) },
    { type: 'report', userKey: k(2) }, { type: 'refresh' },
  ]) assert.deepEqual(validateClientMessage(JSON.stringify(value)), value);
  for (const value of [null, [], { type: 'chat', text: 'unrestricted text' }, { type: 'say', phraseId: 'unknown' },
    { type: 'say', phraseId: '__proto__' }, { type: 'emote', id: 'unknown' }, { type: 'move', x: 1 },
    move(1, 2, { moving: 'yes' }), { type: 'hide', hidden: 'false' }, { type: 'report', userKey: 'access:someone' },
    { type: 'refresh', name: 'Spoofed' }, { type: 'hello', mode: 'online', hidden: false, userId: 'victim' }]) {
    assert.equal(validateClientMessage(JSON.stringify(value)), null);
  }
  assert.ok(validateClientMessage('{"type":"refresh"}'.padEnd(512)));
  assert.equal(validateClientMessage('{"type":"refresh"}'.padEnd(513)), null);
  assert.equal(utf8ByteLength('é🚢'), 6);
  const players = Array.from({ length: 40 }, (_, index) => ({ k: k(index), x: -37.99, z: -24.99, yaw: -3.14, moving: false, running: false }));
  const snapshot = JSON.stringify({ type: 'snapshot', t: NOW, players });
  assert.ok(utf8ByteLength(snapshot) > 512);
  assert.ok(utf8ByteLength(snapshot) < 4096);
  assert.ok(validateServerMessage(snapshot));
  assert.equal(validateClientMessage(snapshot), null);
  assert.equal(validateServerMessage(snapshot.padEnd(4096)), null);
  assert.equal(normalizeClassCode(' abc234 '), 'ABC-234');
  for (const bad of ['ABO-234', 'AB1-234', 'ABI-234', 'AB0-234', 'ABC--234', '../ABC234']) assert.equal(normalizeClassCode(bad), null);
});

await test('movement clamps to each original zone boundary and quantizes finite coordinates and yaw', async () => {
  for (const [zone, { bounds }] of Object.entries(ZONE_CONFIG)) {
    assert.deepEqual(clampMovement(move(99999, -99999, { yaw: 13 * Math.PI, running: true }), zone), {
      x: bounds.maxX, z: bounds.minZ, yaw: -3.14, moving: true, running: true,
    });
    const position = clampMovement(move(-1.234, 2.345, { yaw: -999 }), zone);
    assert.equal(position.x, -1.23);
    assert.equal(position.z, 2.35);
    assert.ok(Math.abs(position.yaw) <= 3.14);
  }
  assert.equal(clampMovement(move(Infinity, 0), 'campus'), null);
});

await test('presence profile is a read-only D1 projection with first name, saved look and semester-derived year', async () => {
  const h = harness();
  try {
    const original = await h.seed('access:school:subject-a', { name: 'Napat SecretFamily', major: 'engine', outfit: 'coverall', gender: 'female', email: 'private@example.test' }, 5);
    const profile = await loadPresenceProfile(h.DB, 'access:school:subject-a');
    assert.equal(profile.name, 'Napat');
    assert.equal(profile.major, 'engine');
    assert.equal(profile.year, 3);
    assert.equal(profile.look.outfit, 'coverall');
    assert.equal(profile.look.gender, 'female');
    assert.equal(profile.look.uniformBottom, 'skirt');
    assert.equal(profile.look.email, undefined);
    assert.equal(profile.look.name, undefined);
    assert.equal(profile.look.origin, undefined);
    assert.equal((await h.DB.prepare('SELECT document FROM academy_accounts WHERE user_id = ?').bind('access:school:subject-a').first()).document, original);
    await assert.rejects(loadPresenceProfile(h.DB, 'missing-user'), error => error.code === 'cadet_required');
    assert.equal(h.DB.userIDs().length, 1);
    for (const name of ['private@example.test', 'access:school:person', 'subject-a']) {
      await h.seed('access:school:subject-a', { name });
      assert.equal((await loadPresenceProfile(h.DB, 'access:school:subject-a')).name, 'Cadet');
    }
  } finally { h.close(); }
});

await test('class codes use real additive SQL migrations, collision retries and idempotent closure', async () => {
  const h = harness();
  try {
    const first = await createClassWorld(h.DB, 'teacher-a', NOW, () => 'ABC-234');
    let attempts = 0;
    const second = await createClassWorld(h.DB, 'teacher-b', NOW, () => ++attempts === 1 ? 'ABC-234' : 'DEF-567');
    assert.equal(attempts, 2);
    assert.deepEqual(await listClassWorlds(h.DB, 'teacher-a'), [first]);
    assert.deepEqual(await listClassWorlds(h.DB, 'teacher-b'), [second]);
    assert.equal((await requireOpenClassWorld(h.DB, 'abc234')).code, first.code);
    const closure = await closeClassWorld(h.DB, first.code, NOW + 1000);
    assert.deepEqual(await closeClassWorld(h.DB, first.code, NOW + 2000), closure);
    await assert.rejects(requireOpenClassWorld(h.DB, first.code), error => error.code === 'class_unavailable');
    assert.deepEqual(await listClassWorlds(h.DB, 'teacher-a'), []);
  } finally { h.close(); }
});

await test('join, publish and leave announce anonymous details once; stationary rooms stop all timers', async () => {
  const h = harness();
  try {
    await h.seed('alice'); await h.seed('bob');
    const a = await h.connect('alice', { hello: false }), b = await h.connect('bob', { hello: false });
    h.clock.advance(500);
    assert.equal(a.ws.frames().length, 1, 'only welcome before hello');
    assert.equal(b.ws.frames().length, 1);
    await h.message(a, { type: 'hello', mode: 'online', hidden: false });
    await h.message(b, { type: 'hello', mode: 'online', hidden: false });
    h.clock.advance(125);
    assert.equal(a.ws.frames('join').length, 1);
    assert.equal(a.ws.frames('join')[0].k, b.key);
    assert.equal(a.ws.frames('snapshot').at(-1).players[0].k, b.key);
    assert.ok(a.ws.frames().findIndex(frame => frame.type === 'join') < a.ws.frames().findIndex(frame => frame.type === 'snapshot'));
    assert.equal(h.clock.timers.size, 0);
    const messageCount = a.ws.messages.length;
    h.clock.advance(60_000);
    assert.equal(a.ws.messages.length, messageCount);
    await h.message(b, move(-32, 20));
    h.clock.advance(125);
    assert.equal(a.ws.frames('join').length, 1, 'moving never repeats profile metadata');
    b.room.webSocketClose(b.ws);
    assert.equal(a.ws.frames('leave').at(-1).k, b.key);
    h.clock.advance(125);
    assert.deepEqual(a.ws.frames('snapshot').at(-1).players, []);
    for (const raw of a.ws.messages) assert.ok(!raw.includes('alice') && !raw.includes('bob'), 'account identifiers stay private');
  } finally { h.close(); }
});

await test('hidden cadets see peers while their identity, movement, bubbles and emotes remain unpublished', async () => {
  const h = harness();
  try {
    await h.seed('a'); await h.seed('b');
    const a = await h.connect('a'), b = await h.connect('b', { hidden: true });
    h.clock.advance(125);
    assert.deepEqual(a.ws.frames('snapshot').at(-1).players, []);
    assert.equal(a.ws.frames('join').length, 0);
    assert.equal(b.ws.frames('snapshot').at(-1).players[0].k, a.key);
    await h.message(b, { type: 'say', phraseId: 'hello' });
    await h.message(b, { type: 'emote', id: 'wave' });
    await h.message(b, move(-30, 20));
    h.clock.advance(125);
    assert.equal(a.ws.frames('say').length, 0);
    assert.equal(a.ws.frames('emote').length, 0);
    assert.ok(a.ws.messages.every(raw => !raw.includes(b.key)));
    await h.message(b, { type: 'hide', hidden: false });
    h.clock.advance(125);
    assert.equal(a.ws.frames('join').at(-1).k, b.key);
    await h.message(b, { type: 'hide', hidden: true });
    assert.equal(a.ws.frames('leave').at(-1).k, b.key);
    h.clock.advance(125);
    assert.deepEqual(a.ws.frames('snapshot').at(-1).players, []);
  } finally { h.close(); }
});

await test('hide and unhide inside one batch recreates the peer through leave, join and a fresh snapshot', async () => {
  const h = harness();
  try {
    await h.seed('a'); await h.seed('b');
    const a = await h.connect('a'), b = await h.connect('b');
    h.clock.advance(125);
    const before = a.ws.messages.length;
    h.clock.advance(1);
    await h.message(b, { type: 'hide', hidden: true });
    h.clock.advance(1);
    await h.message(b, { type: 'hide', hidden: false });
    h.clock.advance(123);
    const frames = a.ws.messages.slice(before).map(raw => JSON.parse(raw));
    assert.deepEqual(frames.map(frame => frame.type), ['leave', 'join', 'snapshot']);
    assert.equal(frames[2].players[0].k, b.key);
    assert.equal(h.clock.timers.size, 0);
  } finally { h.close(); }
});

await test('a send failure during a batch never reannounces the dropped cadet from stale candidates', async () => {
  const h = harness();
  try {
    for (const userId of ['a', 'b', 'c']) await h.seed(userId);
    const a = await h.connect('a'), b = await h.connect('b'), c = await h.connect('c');
    h.clock.advance(125);
    const before = b.ws.messages.length;
    a.ws.send = () => { throw new Error('simulated disconnected socket'); };
    await h.message(c, move(-32, 20));
    h.clock.advance(125);
    const frames = b.ws.messages.slice(before).map(raw => JSON.parse(raw));
    assert.equal(a.ws.closeCode, 1011);
    assert.ok(frames.some(frame => frame.type === 'leave' && frame.k === a.key));
    assert.ok(frames.every(frame => frame.type !== 'join' || frame.k !== a.key));
    assert.ok(frames.filter(frame => frame.type === 'snapshot').every(frame => frame.players.every(player => player.k !== a.key)));
    assert.equal(Object.hasOwn(b.room.sessions.get(b.ws).known, a.key), false);
    assert.equal(Object.hasOwn(c.room.sessions.get(c.ws).known, a.key), false);
    h.clock.advance(125);
    assert.equal(h.clock.timers.size, 0);
  } finally { h.close(); }
});

await test('interest filtering includes only nearest visible peers within 40 units, capped at 40', async () => {
  const viewer = { k: k(0), x: 0, z: 0, ready: true, hidden: false };
  const peers = Array.from({ length: 99 }, (_, index) => ({ k: k(index + 1), x: index / 2, z: 0, ready: true, hidden: false }));
  peers[0].hidden = true;
  peers[1].ready = false;
  const selected = nearbyPlayers(viewer, [viewer, ...peers]);
  assert.equal(selected.length, 40);
  assert.deepEqual(selected.map(peer => peer.k), peers.slice(2, 42).map(peer => peer.k));
  assert.deepEqual(nearbyPlayers(viewer, [{ k: k(1), x: 40, z: 0, ready: true }, { k: k(2), x: 40.01, z: 0, ready: true }]).map(peer => peer.k), [k(1)]);
});

await test('101 racing admissions never exceed 100; overflow chooses instance 1 and refills instance 0 first', async () => {
  const h = harness();
  try {
    await Promise.all(Array.from({ length: 102 }, (_, index) => h.seed(`cadet-${index}`)));
    const clients = await Promise.all(Array.from({ length: 101 }, (_, index) => h.connect(`cadet-${index}`, { hello: false })));
    assert.equal(clients.filter(client => client.name === 'public:campus:0').length, 100);
    assert.equal(clients.filter(client => client.name === 'public:campus:1').length, 1);
    assert.equal(h.getRoom().room.sessions.size, 100);
    const departing = clients.find(client => client.name === 'public:campus:0');
    departing.room.webSocketClose(departing.ws);
    const newcomer = await h.connect('cadet-101');
    assert.equal(newcomer.name, 'public:campus:0');
    assert.notEqual(newcomer.key, departing.key);
    assert.equal(h.getRoom().room.sessions.size, 100);
    for (const { name, request } of h.requests) {
      assert.equal(request.headers.get(PRESENCE_ROOM_HEADER), name);
      assert.ok(decodeURIComponent(request.headers.get(PRESENCE_USER_HEADER)).startsWith('cadet-'));
      assert.equal(request.headers.get('Cf-Access-Jwt-Assertion'), null);
    }
  } finally { h.close(); }
});

await test('bounded overflow exhaustion returns a safe retryable error after lower-first probes', async () => {
  const names = [];
  const env = { PRESENCE_ROOMS: { idFromName: name => name, get: name => ({ async fetch() {
    names.push(name);
    return new Response(null, { status: 409, headers: { 'X-Amcol-Room-Full': '1' } });
  } }) } };
  await assert.rejects(joinPresenceRoom(env, { userId: 'a', zone: 'dorm' }), error => error.code === 'presence_busy');
  assert.deepEqual(names, Array.from({ length: MAX_ROOM_INSTANCES }, (_, instance) => roomName('dorm', instance)));
});

await test('movement uses a rolling 10-per-second limit and communication shares a two-second cooldown', async () => {
  const h = harness();
  try {
    await h.seed('a'); await h.seed('b');
    const a = await h.connect('a'), b = await h.connect('b');
    h.clock.advance(125);
    for (let index = 0; index < 12; index++) await h.message(a, move(-33 + index / 10, 20));
    assert.equal(a.room.sessions.get(a.ws).x, -32.1);
    assert.equal(a.room.sessions.get(a.ws).moveTimes.length, 10);
    await h.message(a, { type: 'say', phraseId: 'roger' });
    await h.message(a, { type: 'emote', id: 'wave' });
    assert.equal(b.ws.frames('say').length, 1);
    assert.equal(b.ws.frames('emote').length, 0);
    h.clock.advance(1000);
    await h.message(a, move(999, -999));
    assert.equal(a.room.sessions.get(a.ws).x, 38);
    assert.equal(a.room.sessions.get(a.ws).z, -25);
    await h.message(a, move(-33, 20));
    h.clock.advance(999);
    await h.message(a, { type: 'emote', id: 'salute' });
    assert.equal(b.ws.frames('emote').length, 0);
    h.clock.advance(1);
    await h.message(a, { type: 'emote', id: 'salute' });
    assert.equal(b.ws.frames('emote').length, 1);
  } finally { h.close(); }
});

await test('oversized UTF-8 and binary messages close safely; invalid types and phrase IDs never broadcast', async () => {
  const h = harness();
  try {
    await h.seed('a'); await h.seed('b'); await h.seed('c');
    const a = await h.connect('a'), b = await h.connect('b'), c = await h.connect('c');
    h.clock.advance(125);
    for (const invalid of ['not json', '{"type":"say","phraseId":"arbitrary text"}', '{"type":"profile","name":"victim"}', '[{"type":"refresh"}]']) await h.message(a, invalid);
    assert.equal(a.ws.closeCode, undefined);
    assert.equal(b.ws.frames('say').length, 0);
    await h.message(a, JSON.stringify({ type: 'say', phraseId: 'é'.repeat(260) }));
    assert.equal(a.ws.closeCode, 1009);
    await c.room.webSocketMessage(c.ws, new Uint8Array(12).buffer);
    assert.equal(c.ws.closeCode, 1003);
  } finally { h.close(); }
});

await test('mute and rolling rate limits survive hibernation without repeating join metadata or idle snapshots', async () => {
  const h = harness();
  try {
    await h.seed('a'); await h.seed('b');
    const a = await h.connect('a'), b = await h.connect('b');
    h.clock.advance(125);
    await h.message(a, { type: 'mute', userKey: b.key });
    await h.message(b, { type: 'say', phraseId: 'hello' });
    for (let index = 0; index < 10; index++) await h.message(b, move(-32, 20));
    h.clock.advance(125);
    const joined = a.ws.frames('join').length, snapshots = a.ws.frames('snapshot').length;
    const room = h.hibernate();
    assert.equal(room.timer, null);
    await h.message(b, move(-20, 20));
    assert.equal(room.sessions.get(b.ws).x, -32, 'movement budget survives wake');
    await h.message(b, { type: 'emote', id: 'wave' });
    assert.equal(a.ws.frames('emote').length, 0);
    assert.equal(a.ws.frames('join').length, joined);
    assert.equal(a.ws.frames('snapshot').length, snapshots);
    h.clock.advance(2000);
    await h.message(b, { type: 'say', phraseId: 'roger' });
    assert.equal(a.ws.frames('say').length, 0, 'session mute survives wake');
    assert.equal(h.clock.timers.size, 0);
    await h.message(b, move(-31, 20));
    h.clock.advance(125);
    assert.equal(a.ws.frames('join').length, joined);
    assert.equal(a.ws.frames('snapshot').length, snapshots + 1);
  } finally { h.close(); }
});

await test('reports resolve only visible session keys to verified D1 account IDs and never touch saved progress', async () => {
  const h = harness();
  try {
    const original = await h.seed('private-reporter'); await h.seed('private-reported');
    const a = await h.connect('private-reporter'), b = await h.connect('private-reported');
    h.clock.advance(125);
    await h.message(a, { type: 'report', userKey: k(999) });
    await h.message(a, { type: 'report', userKey: a.key });
    await h.message(a, { type: 'report', userKey: b.key });
    await h.message(a, { type: 'report', userKey: b.key });
    const rows = (await h.DB.batch([h.DB.prepare('SELECT reporter_id, reported_id, room, reported_at FROM presence_reports WHERE reporter_id = ?').bind('private-reporter')]))[0].results;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].reporter_id, 'private-reporter');
    assert.equal(rows[0].reported_id, 'private-reported');
    assert.equal(rows[0].room, 'public:campus:0');
    assert.equal(rows[0].reported_at, new Date(NOW + 125).toISOString());
    assert.equal((await h.DB.prepare('SELECT document FROM academy_accounts WHERE user_id = ?').bind('private-reporter').first()).document, original);
    assert.ok(a.ws.messages.every(raw => !raw.includes('private-reporter') && !raw.includes('private-reported')));
  } finally { h.close(); }
});

await test('refresh rereads the saved appearance and resends metadata only when the saved profile changes', async () => {
  const h = harness();
  try {
    await h.seed('a'); await h.seed('b');
    const a = await h.connect('a'), b = await h.connect('b');
    h.clock.advance(125);
    const before = a.ws.frames('join').length;
    await h.message(b, { type: 'refresh', look: { outfit: 'forged' }, name: 'forged' });
    assert.equal(a.ws.frames('join').length, before);
    await h.seed('b', { name: 'Newname Surname', outfit: 'immersion', major: 'engine' }, 8);
    await h.message(b, { type: 'refresh' });
    h.clock.advance(125);
    const update = a.ws.frames('join').at(-1);
    assert.equal(update.k, b.key);
    assert.equal(update.name, 'Newname');
    assert.equal(update.look.outfit, 'immersion');
    assert.equal(update.major, 'engine');
    assert.equal(update.year, 4);
    assert.equal(a.ws.frames('join').length, before + 1);
    h.clock.advance(1000);
    await h.message(b, { type: 'refresh' });
    h.clock.advance(125);
    assert.equal(a.ws.frames('join').length, before + 1);
  } finally { h.close(); }
});

await test('appearance saves inside the refresh cooldown coalesce into one trailing read of the latest saved outfit', async () => {
  const h = harness();
  try {
    await h.seed('a'); await h.seed('b');
    const a = await h.connect('a'), b = await h.connect('b');
    h.clock.advance(125);
    const prepare = h.DB.prepare.bind(h.DB);
    let reads = 0;
    h.DB.prepare = sql => {
      if (sql.includes("'$.journey.profile'")) reads++;
      return prepare(sql);
    };
    await h.seed('b', { outfit: 'coverall' });
    await h.message(b, { type: 'refresh' });
    h.clock.advance(100);
    await h.seed('b', { outfit: 'immersion' });
    await Promise.all(Array.from({ length: 20 }, () => h.message(b, { type: 'refresh' })));
    assert.equal(reads, 1, 'the burst does not bypass the D1 throttle');
    assert.equal(b.ws.deserializeAttachment().refreshPending, true);
    h.clock.advance(899);
    await h.clock.settle();
    assert.equal(reads, 1, 'the next read waits until the full one-second interval');
    h.clock.advance(1);
    await h.clock.settle();
    h.clock.advance(125);
    assert.equal(reads, 2, 'one trailing read satisfies the whole burst');
    assert.equal(a.ws.frames('join').at(-1).look.outfit, 'immersion');
    assert.equal(b.ws.deserializeAttachment().refreshPending, false);
    assert.equal(b.room.refreshes.size, 0);
    assert.equal(h.clock.timers.size, 0);
    const count = a.ws.messages.length;
    h.clock.advance(60_000);
    assert.equal(a.ws.messages.length, count);
  } finally { h.close(); }
});

await test('a refresh arriving during an older in-flight D1 read is followed by a read of the newer save', async () => {
  const h = harness();
  try {
    await h.seed('a'); await h.seed('b');
    const a = await h.connect('a'), b = await h.connect('b');
    h.clock.advance(125);
    const prepare = h.DB.prepare.bind(h.DB);
    let reads = 0, release, markStarted;
    const blocked = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { markStarted = resolve; });
    h.DB.prepare = sql => {
      const prepared = prepare(sql);
      return { bind(...values) {
        const bound = prepared.bind(...values);
        return sql.includes("'$.journey.profile'") ? { ...bound, async first() {
          const read = ++reads, row = await bound.first();
          if (read === 1) { markStarted(); await blocked; }
          return row;
        } } : bound;
      } };
    };
    await h.seed('b', { outfit: 'coverall' });
    const first = h.message(b, { type: 'refresh' });
    await started;
    h.clock.advance(1200);
    await h.seed('b', { outfit: 'immersion' });
    await h.message(b, { type: 'refresh' });
    assert.equal(reads, 1, 'only one profile read is in flight');
    release();
    await first;
    await h.clock.settle();
    h.clock.advance(125);
    assert.equal(reads, 2);
    assert.equal(b.room.sessions.get(b.ws).profile.look.outfit, 'immersion');
    assert.equal(a.ws.frames('join').at(-1).look.outfit, 'immersion');
    assert.equal(h.clock.timers.size, 0);
    assert.equal(b.room.refreshes.size, 0);
  } finally { h.close(); }
});

await test('queued refresh intent survives reconstruction and its finite timer is cancelled on disconnect', async () => {
  const h = harness();
  try {
    await h.seed('a'); await h.seed('b');
    const a = await h.connect('a'), b = await h.connect('b');
    h.clock.advance(125);
    await h.message(b, { type: 'refresh' });
    h.clock.advance(100);
    await h.seed('b', { outfit: 'immersion' });
    await h.message(b, { type: 'refresh' });
    assert.equal(b.ws.deserializeAttachment().refreshPending, true);
    // Normal hibernation waits for this timer. Simulate loss of in-memory work
    // explicitly to verify the attachment is sufficient to resume the request.
    const oldTask = b.room.refreshes.get(b.ws);
    h.clock.clearTimeout(oldTask.timer);
    const room = h.hibernate();
    assert.equal(h.clock.timers.size, 1);
    h.clock.advance(900);
    await h.clock.settle();
    h.clock.advance(125);
    assert.equal(a.ws.frames('join').at(-1).look.outfit, 'immersion');
    assert.equal(h.clock.timers.size, 0);
    await h.seed('b', { outfit: 'coverall' });
    await h.message(b, { type: 'refresh' });
    assert.equal(h.clock.timers.size, 1, 'a final pending request has one timer');
    room.webSocketClose(b.ws);
    h.clock.advance(125);
    assert.equal(room.refreshes.size, 0);
    assert.equal(h.clock.timers.size, 0, 'no profile timer remains for the closed socket');
    h.clock.advance(1000);
    await h.clock.settle();
    assert.equal(h.clock.timers.size, 0);
  } finally { h.close(); }
});

await test('closing a class actively disconnects every zone and prevents new joins, including after hibernation', async () => {
  const h = harness();
  try {
    await createClassWorld(h.DB, 'teacher', NOW, () => 'ABC-234');
    await h.seed('a'); await h.seed('b'); await h.seed('c');
    const clients = await Promise.all(['campus', 'dorm', 'atlantic'].map((zone, index) => h.connect(['a', 'b', 'c'][index], { zone, code: 'ABC-234' })));
    h.clock.advance(125);
    h.hibernate('class:ABC-234:campus:0');
    await closeClassWorld(h.DB, 'ABC-234', NOW);
    await closeClassRooms(h.env, 'ABC-234');
    for (const client of clients) assert.equal(client.ws.closeCode, 4003);
    assert.equal(h.clock.timers.size, 0);
    await assert.rejects(h.connect('a', { code: 'ABC-234' }), error => error.code === 'class_unavailable');
    assert.ok((await h.connect('a')).response.status === 101, 'public play still works');
  } finally { h.close(); }
});

await test('a class close racing asynchronous admission cannot leave an accepted socket behind', async () => {
  const h = harness();
  try {
    await createClassWorld(h.DB, 'teacher', NOW, () => 'ABC-234');
    await h.seed('a');
    const holder = h.getRoom('class:ABC-234:campus:0');
    const originalPrepare = h.DB.prepare.bind(h.DB);
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    h.DB.prepare = sql => {
      const prepared = originalPrepare(sql);
      return { bind(...values) {
        const bound = prepared.bind(...values);
        return sql.includes("'$.journey.profile'") ? { ...bound, async first() { const row = await bound.first(); await gate; return row; } } : bound;
      } };
    };
    const pending = holder.room.fetch(new Request('https://presence.internal/connect', { headers: {
      Upgrade: 'websocket', [PRESENCE_ROOM_HEADER]: 'class:ABC-234:campus:0', [PRESENCE_USER_HEADER]: 'a',
    } }));
    await holder.room.fetch(new Request('https://presence.internal/close', { method: 'POST', headers: { [PRESENCE_ROOM_HEADER]: 'class:ABC-234:campus:0' } }));
    release();
    assert.equal((await pending).status, 404);
    assert.equal(holder.room.sessions.size, 0);
  } finally { h.close(); }
});

await test('a simulated 100-player room emits fewer than 4 KiB and at most eight snapshots/second/client', async () => {
  const h = harness();
  try {
    await Promise.all(Array.from({ length: 100 }, (_, index) => h.seed(`load-${index}`)));
    const clients = await Promise.all(Array.from({ length: 100 }, (_, index) => h.connect(`load-${index}`)));
    for (let frame = 0; frame < 8; frame++) {
      await Promise.all(clients.map((client, index) => h.message(client, move(-5 + index / 100 + frame / 100, 1, { yaw: -3.14, moving: frame !== 7, running: frame % 2 === 0 }))));
      h.clock.advance(125);
    }
    let largest = 0;
    for (const client of clients) {
      const snapshots = client.ws.frames('snapshot');
      assert.equal(snapshots.length, 8);
      for (const snapshot of snapshots) {
        const bytes = utf8ByteLength(JSON.stringify(snapshot));
        largest = Math.max(largest, bytes);
        assert.ok(bytes < 4096);
        assert.equal(snapshot.players.length, 40);
        assert.ok(snapshots.filter(other => other.t > snapshot.t - 1000 && other.t <= snapshot.t).length <= 8);
        assert.ok(snapshot.players.every(player => !Object.hasOwn(player, 'look') && !Object.hasOwn(player, 'name')));
      }
    }
    assert.equal(h.clock.timers.size, 0);
    const count = clients[0].ws.messages.length;
    h.clock.advance(60_000);
    assert.equal(clients[0].ws.messages.length, count, 'idle room sends nothing');
    console.log(`  100 cadets: largest observed snapshot ${largest} bytes; 8 snapshots/client in 1 second; zero idle timers.`);
  } finally { h.close(); }
});

console.log(`\n${passed} offline presence, class-world, privacy and 100-player checks passed.`);
