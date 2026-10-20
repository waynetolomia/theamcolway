import assert from 'node:assert/strict';
let passed = 0;
async function test(name, work) { await work(); passed++; console.log(`PASS ${name}`); }
import { readFile } from 'node:fs/promises';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { createAuthenticator } from '../src/auth.mjs';
import { createWorker } from '../src/worker.mjs';
import { sqliteD1 } from './sqlite-d1.mjs';

const DOMAIN = 'amcol-test.cloudflareaccess.com';
const AUD = '0123456789abcdef'.repeat(4);
const ISSUER = `https://${DOMAIN}`;
const GAME_ORIGIN = 'https://the-amcol-way.example.workers.dev';
const BASE = { ENVIRONMENT: 'production', ACCESS_TEAM_DOMAIN: DOMAIN, ACCESS_AUD: AUD };
const NOW = Date.parse('2026-10-19T11:30:00Z');
const { privateKey, publicKey } = await generateKeyPair('RS256');
const publicJWK = { ...await exportJWK(publicKey), kid: 'test-signing-key', alg: 'RS256', use: 'sig' };
let requestsToJWKS = 0;
async function fetchJWKS(url) {
  requestsToJWKS++;
  assert.equal(String(url), `${ISSUER}/cdn-cgi/access/certs`);
  return Response.json({ keys: [publicJWK] });
}
async function token(sub = 'cadet-a', claims = {}, key = privateKey) {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-signing-key' })
    .setIssuer(claims.iss ?? ISSUER).setAudience(claims.aud ?? AUD)
    .setSubject(sub).setIssuedAt().setExpirationTime(claims.exp ?? '5m').sign(key);
}
function harness() {
  const DB = sqliteD1();
  const assets = [];
  const worker = createWorker({ authenticate: createAuthenticator({ fetchJWKS }), now: () => NOW });
  const env = { ...BASE, DB, ASSETS: { async fetch(request) {
    const path = new URL(request.url).pathname;
    assets.push(path);
    try {
      const file = await readFile(new URL(`../public${path}`, import.meta.url));
      return new Response(file, { headers: { 'Content-Type': path.endsWith('.html') ? 'text/html' : 'application/octet-stream' } });
    } catch { return new Response('Not found', { status: 404 }); }
  } } };
  return { worker, DB, env, assets, close: () => DB.close() };
}
function request(path = '/api/academy', { jwt, method = 'GET', payload, body, headers = {}, origin = GAME_ORIGIN } = {}) {
  return new Request(`${origin}${path}`, { method,
    headers: { ...(jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {}),
      ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : body !== undefined ? { body } : {}),
  });
}
const errorCode = async response => (await response.json()).error.code;

await test('missing JWT and forged hosting/email headers cannot read, create or mutate a student', async () => {
  const h = harness();
  try {
    for (const method of ['GET', 'POST']) {
      const response = await h.worker.fetch(request('/api/academy', { method,
        ...(method === 'POST' ? { payload: { action: 'init', profile: { name: 'Forged' } } } : {}),
        headers: { 'oai-authenticated-user-id': 'victim', 'Cf-Access-Authenticated-User-Email': 'victim@example.test' },
      }), h.env);
      assert.equal(response.status, 401);
      assert.equal(await errorCode(response), 'sign_in_required');
    }
    assert.deepEqual(h.DB.userIDs(), []);
  } finally { h.close(); }
});

await test('a genuine signed JWT validates with a mocked JWKS; no origin/network is contacted', async () => {
  const before = requestsToJWKS;
  const auth = createAuthenticator({ fetchJWKS });
  const signed = await token();
  assert.equal(await auth(request('/api/academy', { jwt: signed }), BASE), `access:${DOMAIN}:cadet-a`);
  assert.equal(await auth(request('/api/academy', { jwt: signed }), BASE), `access:${DOMAIN}:cadet-a`);
  assert.equal(requestsToJWKS - before, 1, 'jose caches the verified signing key set');
});

await test('wrong signatures, issuer, audience, expired and malformed tokens fail closed', async () => {
  const h = harness();
  const other = await generateKeyPair('RS256');
  try {
    const signed = await Promise.all([
      token('cadet-a', {}, other.privateKey),
      token('cadet-a', { iss: 'https://other.cloudflareaccess.com' }),
      token('cadet-a', { aud: 'different-audience-123456' }),
      token('cadet-a', { exp: Math.floor(Date.now() / 1000) - 60 }),
      token(''),
    ]);
    for (const jwt of [...signed, 'not.a.jwt', `${'a'.repeat(16_385)}`]) {
      const response = await h.worker.fetch(request('/api/academy', { jwt }), h.env);
      assert.equal(response.status, 401);
    }
    assert.deepEqual(h.DB.userIDs(), []);
  } finally { h.close(); }
});

await test('a token with no expiration and an unsigned token are rejected', async () => {
  const h = harness();
  try {
    const noExpiry = await new SignJWT({ sub: 'cadet-a', iss: ISSUER, aud: AUD })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-signing-key' }).setIssuedAt().sign(privateKey);
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'victim', iss: ISSUER, aud: AUD })).toString('base64url')}.`;
    for (const jwt of [noExpiry, unsigned]) {
      assert.equal((await h.worker.fetch(request('/api/academy', { jwt }), h.env)).status, 401);
    }
  } finally { h.close(); }
});

await test('missing or invalid production Access settings block API and static book assets', async () => {
  const h = harness();
  try {
    for (const changes of [{ ACCESS_AUD: '' }, { ACCESS_TEAM_DOMAIN: '' },
      { ACCESS_TEAM_DOMAIN: 'https://amcol-test.cloudflareaccess.com' },
      { ACCESS_TEAM_DOMAIN: 'amcol-test.cloudflareaccess.com.attacker.test' }]) {
      for (const path of ['/api/academy', '/game/index.html', '/game/assets/maritime-english-317-plus.pdf']) {
        const response = await h.worker.fetch(request(path, { jwt: await token() }), { ...h.env, ...changes });
        assert.equal(response.status, 503);
      }
    }
    assert.deepEqual(h.assets, []);
    assert.deepEqual(h.DB.userIDs(), []);
  } finally { h.close(); }
});

await test('two verified subjects have independent persisted profiles and ignore client user claims', async () => {
  const h = harness();
  try {
    const a = await token('cadet-a'), b = await token('cadet-b');
    for (const [jwt, name] of [[a, 'Cadet A'], [b, 'Cadet B']]) {
      const response = await h.worker.fetch(request('/api/academy', { jwt, method: 'POST', payload: {
        action: 'init', userId: 'victim', profile: { name }, now: '2099-01-01', allowance: { used: 0 },
      } }), h.env);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.state.profile.name, name);
      assert.equal(body.serverTime, new Date(NOW).toISOString());
      assert.equal(body.week.remaining, 5);
    }
    for (const [jwt, name] of [[a, 'Cadet A'], [b, 'Cadet B']]) {
      const response = await h.worker.fetch(request('/api/academy', { jwt }), h.env);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal((await response.json()).state.profile.name, name);
    }
    assert.deepEqual(h.DB.userIDs(), [`access:${DOMAIN}:cadet-a`, `access:${DOMAIN}:cadet-b`]);
  } finally { h.close(); }
});

await test('local development requires an explicit fixed identity, environment and loopback URL', async () => {
  const auth = createAuthenticator({ fetchJWKS });
  const env = { ENVIRONMENT: 'development', DEV_MODE: 'true', DEV_USER_ID: 'local-cadet' };
  for (const origin of ['http://localhost:8787', 'http://127.0.0.1:8787', 'http://[::1]:8787']) {
    assert.equal(await auth(request('/', { origin, headers: { 'oai-authenticated-user-id': 'attacker' } }), env), 'local:local-cadet');
  }
  for (const origin of [GAME_ORIGIN, 'http://127.0.0.1.attacker.test', 'https://localhost.attacker.test']) {
    await assert.rejects(auth(request('/', { origin }), env), error => error.code === 'development_identity_blocked');
  }
  for (const changes of [{ ENVIRONMENT: 'production' }, { DEV_USER_ID: '' }, { DEV_USER_ID: '../victim' }]) {
    await assert.rejects(auth(request('/', { origin: 'http://localhost:8787' }), { ...env, ...changes }), error => error.code === 'development_identity_blocked');
  }
  await assert.rejects(auth(request('/', { origin: 'http://localhost:8787' }), { ...env, DEV_MODE: 'false' }), error => error.code === 'access_not_configured');
});

await test('cross-origin requests, unsupported content types and invalid JSON cannot mutate records', async () => {
  const h = harness(), jwt = await token();
  try {
    const cases = [
      { headers: { Origin: 'https://attacker.test' }, payload: { action: 'init' }, status: 403 },
      { headers: { 'Sec-Fetch-Site': 'cross-site' }, payload: { action: 'init' }, status: 403 },
      { headers: { 'Content-Type': 'text/plain' }, body: '{}', status: 415 },
      { headers: { 'Content-Type': 'application/jsonp' }, body: '{}', status: 415 },
      { headers: { 'Content-Type': 'application/json' }, body: '{broken', status: 400 },
    ];
    for (const item of cases) {
      const response = await h.worker.fetch(request('/api/academy', { jwt, method: 'POST', ...item }), h.env);
      assert.equal(response.status, item.status);
    }
    assert.deepEqual(h.DB.userIDs(), []);
  } finally { h.close(); }
});

await test('declared or streamed request sizes above 96,000 bytes are rejected including Unicode bodies', async () => {
  const h = harness(), jwt = await token();
  try {
    for (const item of [
      { body: '{}', headers: { 'Content-Type': 'application/json', 'Content-Length': '96001' } },
      { body: JSON.stringify({ text: 'a'.repeat(96_000) }), headers: { 'Content-Type': 'application/json' } },
      { body: JSON.stringify({ text: 'é'.repeat(48_000) }), headers: { 'Content-Type': 'application/json' } },
    ]) {
      const response = await h.worker.fetch(request('/api/academy', { jwt, method: 'POST', ...item }), h.env);
      assert.equal(response.status, 413);
      assert.equal(await errorCode(response), 'request_too_large');
    }
    assert.deepEqual(h.DB.userIDs(), []);
  } finally { h.close(); }
});

await test('authenticated routing opens the game and only public/ assets; auth failure never reaches asset binding', async () => {
  const h = harness(), jwt = await token();
  try {
    assert.equal((await h.worker.fetch(request('/game/index.html'), h.env)).status, 401);
    assert.deepEqual(h.assets, []);
    const home = await h.worker.fetch(request('/', { jwt }), h.env);
    assert.equal(home.status, 302);
    assert.equal(home.headers.get('location'), '/game/index.html');
    const game = await h.worker.fetch(request('/game/index.html', { jwt }), h.env);
    assert.equal(game.status, 200);
    assert.match(await game.text(), /<title>THE AMCOL WAY<\/title>/);
    assert.equal(game.headers.get('cache-control'), 'private, no-store');
    for (const path of ['/instructor/answers.json', '/.env', '/.dev.vars', '/src/auth.mjs', '/migrations/0000_chubby_captain_flint.sql']) {
      assert.equal((await h.worker.fetch(request(path, { jwt }), h.env)).status, 404);
    }
    const signin = await h.worker.fetch(request('/auth/login?return_to=https://attacker.test'), h.env);
    assert.equal(signin.status, 303);
    assert.equal(signin.headers.get('location'), '/game/index.html');
  } finally { h.close(); }
});

await test('API method guards and missing D1 fail without revealing internal details', async () => {
  const h = harness(), jwt = await token();
  try {
    const method = await h.worker.fetch(request('/api/academy', { jwt, method: 'DELETE' }), h.env);
    assert.equal(method.status, 405);
    assert.equal(method.headers.get('allow'), 'GET, POST');
    const missing = await h.worker.fetch(request('/api/academy', { jwt }), { ...h.env, DB: null });
    assert.equal(missing.status, 503);
    assert.equal(await errorCode(missing), 'storage_unavailable');
    const unknown = await h.worker.fetch(request('/api/unknown', { jwt }), h.env);
    assert.equal(unknown.status, 404);
  } finally { h.close(); }
});

console.log(`\n${passed} authenticated Worker, JWT and real-SQLite checks passed.`);
