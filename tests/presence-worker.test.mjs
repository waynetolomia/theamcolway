import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { createAuthenticator, isStaff } from '../src/auth.mjs';
import { createWorker } from '../src/worker.mjs';
import { sqliteD1 } from './sqlite-d1.mjs';

const ORIGIN = 'https://amcol-presence.example';
const TEAM = 'presence-tests.cloudflareaccess.com';
const AUD = '0123456789abcdef'.repeat(4);
const NOW = Date.parse('2026-10-21T02:00:00Z');
const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwk = { ...await exportJWK(publicKey), kid: 'presence-test', alg: 'RS256', use: 'sig' };
const fetchJWKS = async () => Response.json({ keys: [jwk] });
const baseEnv = { ENVIRONMENT: 'production', ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD,
  STAFF_EMAILS: 'Teacher@amcol.test, director@amcol.test' };
const jwt = (sub, email) => new SignJWT(email === undefined ? {} : { email })
  .setProtectedHeader({ alg: 'RS256', kid: 'presence-test' })
  .setIssuer(`https://${TEAM}`).setAudience(AUD).setSubject(sub)
  .setIssuedAt().setExpirationTime('5m').sign(privateKey);
const req = (path, token, options = {}) => new Request(`${options.origin || ORIGIN}${path}`, {
  method: options.method || 'GET',
  headers: { ...(token ? { 'Cf-Access-Jwt-Assertion': token } : {}),
    ...(options.payload !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options.upgrade ? { Upgrade: 'websocket', Origin: options.origin || ORIGIN } : {}),
    ...options.headers },
  ...(options.payload !== undefined ? { body: JSON.stringify(options.payload) } : {}),
});
function harness() {
  const DB = sqliteD1(), joins = [], closes = [];
  const env = { ...baseEnv, DB, PRESENCE_ROOMS: {} };
  const worker = createWorker({ authenticate: createAuthenticator({ fetchJWKS, includeIdentity: true }), now: () => NOW,
    joinPresence: async (bindings, verified) => { joins.push(verified); return new Response('verified upgrade'); },
    closePresence: async (bindings, code) => { closes.push(code); },
  });
  return { DB, env, worker, joins, closes, close: () => DB.close() };
}
let passed = 0;
async function test(name, run) { await run(); passed++; console.log(`PASS ${name}`); }

await test('missing/invalid JWT is rejected before any presence object or D1 access', async () => {
  const h = harness();
  try {
    for (const token of [undefined, 'forged.token.value']) {
      const r = await h.worker.fetch(req('/api/presence?zone=campus', token, { upgrade: true }), h.env);
      assert.equal(r.status, 401);
    }
    assert.deepEqual(h.joins, []); assert.deepEqual(h.DB.userIDs(), []);
  } finally { h.close(); }
});

await test('WebSocket requires exact same origin and rejects missing origin and cross-site metadata', async () => {
  const h = harness(), token = await jwt('cadet');
  try {
    for (const headers of [{ Origin: 'https://other.example' }, { Origin: 'null' }, { Origin: '' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
      const r = await h.worker.fetch(req('/api/presence?zone=campus', token, { upgrade: true, headers }), h.env);
      assert.equal(r.status, 403);
    }
    assert.equal(h.joins.length, 0);
  } finally { h.close(); }
});

await test('verified subject is forwarded; query IDs and internal impersonation headers are ignored', async () => {
  const h = harness(), token = await jwt('real-cadet', 'cadet@amcol.test');
  try {
    const r = await h.worker.fetch(req('/api/presence?zone=dorm&userId=victim&dev_user=victim', token, {
      upgrade: true, headers: { 'X-Presence-User': 'victim', 'Cf-Access-Authenticated-User-Email': 'teacher@amcol.test' },
    }), h.env);
    assert.equal(r.status, 200);
    assert.deepEqual(h.joins, [{ userId: `access:${TEAM}:real-cadet`, zone: 'dorm', code: null }]);
    const session = await h.worker.fetch(req('/api/presence/session', token), h.env);
    assert.deepEqual(await session.json(), { enabled: true, staff: false });
    assert.deepEqual(h.DB.userIDs(), [], 'presence/session never creates or changes academic progress');
  } finally { h.close(); }
});

await test('presence method, upgrade, zone and class-code validation happen before room selection', async () => {
  const h = harness(), token = await jwt('cadet');
  try {
    for (const [path, options, status] of [
      ['/api/presence?zone=campus', { method: 'POST', upgrade: true }, 405],
      ['/api/presence?zone=campus', { headers: { Origin: ORIGIN } }, 426],
      ['/api/presence?zone=unknown', { upgrade: true }, 400],
      ['/api/presence?zone=campus&code=bad', { upgrade: true }, 400],
    ]) assert.equal((await h.worker.fetch(req(path, token, options), h.env)).status, status);
    assert.equal(h.joins.length, 0);
  } finally { h.close(); }
});

await test('only verified JWT email grants staff; matching is case insensitive and ignores spoofed headers', async () => {
  const auth = createAuthenticator({ fetchJWKS, includeIdentity: true });
  const identity = await auth(req('/', await jwt('teacher', 'TEACHER@AMCOL.TEST')), baseEnv);
  assert.equal(identity.userId, `access:${TEAM}:teacher`);
  assert.equal(identity.email, 'teacher@amcol.test');
  assert.equal(isStaff(identity, baseEnv), true);
  assert.equal(isStaff(identity, { ...baseEnv, STAFF_EMAILS: '' }), false);
  const student = await auth(req('/', await jwt('student'), {
    headers: { 'Cf-Access-Authenticated-User-Email': 'teacher@amcol.test' },
  }), baseEnv);
  assert.equal(student.email, null); assert.equal(isStaff(student, baseEnv), false);
});

await test('cadets cannot list, create, or close classes by spoofing staff fields', async () => {
  const h = harness(), token = await jwt('cadet', 'cadet@amcol.test');
  try {
    for (const options of [{}, { method: 'POST', payload: { action: 'create', staff: true, email: 'teacher@amcol.test' } },
      { method: 'POST', payload: { action: 'close', code: 'ABC-DEF' } }]) {
      assert.equal((await h.worker.fetch(req('/api/class-worlds', token, options), h.env)).status, 403);
    }
    assert.equal(h.closes.length, 0);
  } finally { h.close(); }
});

await test('staff class create/list/close, cadet validation, and closed-code rejection use additive SQL', async () => {
  const h = harness(), staff = await jwt('teacher', 'Teacher@amcol.test'), cadet = await jwt('cadet');
  try {
    const created = await h.worker.fetch(req('/api/class-worlds', staff, { method: 'POST', payload: { action: 'create' } }), h.env);
    assert.equal(created.status, 201);
    const { world } = await created.json();
    assert.match(world.code, /^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);
    const listed = await h.worker.fetch(req('/api/class-worlds', staff), h.env);
    assert.equal((await listed.json()).worlds[0].code, world.code);
    const check = await h.worker.fetch(req(`/api/presence/session?code=${world.code.toLowerCase()}`, cadet), h.env);
    assert.deepEqual(await check.json(), { enabled: true, staff: false, code: world.code });
    const closed = await h.worker.fetch(req('/api/class-worlds', staff, { method: 'POST', payload: { action: 'close', code: world.code } }), h.env);
    assert.equal(closed.status, 200); assert.deepEqual(h.closes, [world.code]);
    assert.equal((await h.worker.fetch(req(`/api/presence/session?code=${world.code}`, cadet), h.env)).status, 404);
    assert.deepEqual(h.DB.userIDs(), [], 'class operations leave academy accounts untouched');
  } finally { h.close(); }
});

await test('class writes reject cross-origin requests even from verified staff', async () => {
  const h = harness(), staff = await jwt('teacher', 'teacher@amcol.test');
  try {
    const r = await h.worker.fetch(req('/api/class-worlds', staff, { method: 'POST',
      payload: { action: 'create' }, headers: { Origin: 'https://attacker.example' } }), h.env);
    assert.equal(r.status, 403);
    const worlds = await h.worker.fetch(req('/api/class-worlds', staff), h.env);
    assert.deepEqual((await worlds.json()).worlds, []);
  } finally { h.close(); }
});

await test('two local users require explicit opt-in, development flags and exact loopback', async () => {
  const auth = createAuthenticator({ fetchJWKS, includeIdentity: true });
  const local = { ENVIRONMENT: 'development', DEV_MODE: 'true', DEV_USER_ID: 'default-cadet' };
  const localReq = user => req(`/?dev_user=${user}`, undefined, { origin: 'http://127.0.0.1:8787' });
  assert.equal((await auth(localReq('cadet-a'), local)).userId, 'local:default-cadet');
  const allowed = { ...local, DEV_ALLOW_USER_SWITCH: 'true' };
  for (const user of ['cadet-a', 'cadet-b']) {
    const identity = await auth(localReq(user), allowed);
    assert.equal(identity.userId, `local:${user}`); assert.equal(isStaff(identity, allowed), true);
  }
  for (const request of [req('/?dev_user=cadet-a'), localReq('../victim')]) {
    await assert.rejects(auth(request, allowed), error => error.code === 'development_identity_blocked');
  }
  await assert.rejects(auth(localReq('cadet-a'), { ...allowed, ENVIRONMENT: 'production' }),
    error => error.code === 'development_identity_blocked');
  const production = await auth(req('/?dev_user=victim', await jwt('real-user')), { ...baseEnv, DEV_ALLOW_USER_SWITCH: 'true' });
  assert.equal(production.userId, `access:${TEAM}:real-user`); assert.equal(isStaff(production, baseEnv), false);
});

console.log(`\n${passed} presence authorization and class-world Worker checks passed.`);
