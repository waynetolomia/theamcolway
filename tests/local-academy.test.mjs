import assert from 'node:assert/strict';

// A minimal browser page: https URL, localStorage and a static host's fetch.
const storage = new Map();
const fakeStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};
let staticRequests = 0;
const staticHost = async () => { staticRequests++; return new Response('<h1>404</h1>', { status: 404, headers: { 'Content-Type': 'text/html' } }); };
const workerHost = async () => new Response('{"error":{"code":"unauthorized"}}', { status: 401, headers: { 'Content-Type': 'application/json' } });
globalThis.location = { protocol: 'https:', search: '' };
globalThis.localStorage = fakeStorage;
globalThis.fetch = staticHost;

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
const fresh = tag => import(`../public/game/local-academy.js?${tag}`);

const local = await import('../public/game/local-academy.js');
const { AcademyAPI } = await import('../public/game/academy-api.js');
const { NPCS } = await import('../public/game/npc-content.js');
const cadet = { name: 'Beta', gender: 'female', major: 'engine' };

await test('a static host without /api/academy switches to browser storage', async () => {
  assert.equal(await local.detectStorageMode(), 'local');
  assert.equal(local.isLocalMode(), true);
  assert.equal(staticRequests, 1);
});

await test('a JSON answer, even 401, keeps the Cloudflare Worker as the save location', async () => {
  const other = await fresh('worker');
  assert.equal(await other.detectStorageMode(workerHost), 'server');
});

await test('a network failure keeps server mode so Access sign-in is not bypassed', async () => {
  const other = await fresh('offline');
  assert.equal(await other.detectStorageMode(async () => { throw new TypeError('Failed to fetch'); }), 'server');
});

await test('?storage=local forces browser storage without probing', async () => {
  globalThis.location = { protocol: 'https:', search: '?storage=local' };
  const other = await fresh('forced');
  assert.equal(await other.detectStorageMode(async () => assert.fail('must not probe')), 'local');
  globalThis.location = { protocol: 'https:', search: '' };
});

await test('the unchanged client creates a cadet, follows course rules and saves to localStorage', async () => {
  const api = new AcademyAPI();
  await api.load();
  assert.equal(api.state.initialized, false);
  await api.init(cadet);
  assert.equal(api.state.profile.name, 'Beta');
  await api.introduceNPC(NPCS[0].id);
  assert.ok(api.state.orientation.visitedIds.includes(NPCS[0].id));
  // The real rules still apply: sleeping without the daily fitness game is refused.
  await assert.rejects(api.sleep(), error => error.status === 409 || error.status === 400);
  const saved = JSON.parse(storage.get(local.LOCAL_SAVE_KEY));
  assert.equal(saved.document.journey.profile.name, 'Beta');
  assert.ok(saved.revision >= 2);
});

await test('a reload (new client) restores the same journey from the browser', async () => {
  const api = new AcademyAPI();
  await api.load();
  assert.equal(api.state.initialized, true);
  assert.ok(api.state.orientation.visitedIds.includes(NPCS[0].id));
});

await test('stale tokens from another tab are refused like on the server', async () => {
  const api = new AcademyAPI(); await api.load();
  api.state = { ...api.state, day: api.state.day + 5 };
  await assert.rejects(api.introduceNPC(NPCS[1].id), error => error.code === 'stale_day');
});

await test('a downloaded backup restores over a newer journey', async () => {
  const backup = { format: 'amcol-local-academy-backup', ...JSON.parse(storage.get(local.LOCAL_SAVE_KEY)) };
  const api = new AcademyAPI(); await api.load();
  await api.newJourney({ ...cadet, name: 'Other' });
  assert.equal(api.state.profile.name, 'Other');
  const file = { size: 1000, text: async () => JSON.stringify(backup) };
  assert.equal(await local.restoreLocalBackup(file), 'Beta');
  const reloaded = new AcademyAPI(); await reloaded.load();
  assert.equal(reloaded.state.profile.name, 'Beta');
  assert.ok(reloaded.revision > api.revision, 'Restored save must win over open tabs');
  await assert.rejects(local.restoreLocalBackup({ size: 10, text: async () => '{"format":"seapath-book-record"}' }), /not a THE AMCOL WAY browser save/);
});

await test('blocked storage still plays in memory and reports that nothing persists', async () => {
  globalThis.localStorage = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
  const api = new AcademyAPI(); await api.load(); await api.init(cadet);
  assert.equal(api.state.initialized, true);
  assert.equal(local.isPersistent(), false);
  globalThis.localStorage = fakeStorage;
});

await test('a full browser store returns a clear storage_full error and keeps the old save', async () => {
  const before = storage.get(local.LOCAL_SAVE_KEY);
  globalThis.localStorage = { ...fakeStorage, setItem() { throw new Error('QuotaExceededError'); } };
  const api = new AcademyAPI(); await api.load();
  await assert.rejects(api.introduceNPC(NPCS[2].id), error => error.code === 'storage_full');
  assert.equal(storage.get(local.LOCAL_SAVE_KEY), before);
  globalThis.localStorage = fakeStorage;
});

console.log(`\n${passed} browser-save beta checks passed.`);
