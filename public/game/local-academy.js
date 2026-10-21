/**
 * Browser-only academy for beta testing and static hosting (GitHub Pages, a learning hub).
 * It applies the same course rules as the Cloudflare Worker, but saves the account in this
 * browser's localStorage instead of D1. Progress is per browser and can be backed up as JSON.
 *
 * Mode selection, first match wins:
 *   1. ?storage=local or ?storage=server in the page URL
 *   2. <meta name="amcol-storage" content="local|server"> in index.html
 *   3. auto: probe /api/academy once. A JSON answer means the Worker is present; any other
 *      answer (a static host's 404 page) means browser storage. A network error keeps server
 *      mode so an expired Cloudflare Access session still shows the sign-in screen.
 */
import { AcademyError, applyAction, createAccount, publicState, getWeekStatus } from './course-progress.js';
import { ACTIVITIES } from './book-course.js';
import { apiURL } from './api-url.js';

export const LOCAL_SAVE_KEY = 'amcol.local-academy.v1';
const BACKUP_FORMAT = 'amcol-local-academy-backup';
const ENDPOINT = '/api/academy';
const PROBE_TIMEOUT_MS = 4000;

const inBrowserPage = () => /^https?:$/.test(globalThis.location?.protocol || '');
let mode = null;          // 'local' | 'server' once known
let detecting = null;
let memoryRow = null;     // used only when localStorage is blocked
let persistent = true;

function requestedMode() {
  try {
    const query = new URLSearchParams(globalThis.location?.search || '').get('storage');
    if (query === 'local' || query === 'server') return query;
  } catch { /* no URL in this environment */ }
  const meta = globalThis.document?.querySelector?.('meta[name="amcol-storage"]')?.content;
  return meta === 'local' || meta === 'server' ? meta : 'auto';
}

async function probe(fetcher) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS) : null;
  try {
    const response = await fetcher(apiURL(ENDPOINT), { method: 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller?.signal });
    return /json/i.test(response.headers.get('content-type') || '') ? 'server' : 'local';
  } catch {
    return 'server';
  } finally { if (timer) clearTimeout(timer); }
}

export function detectStorageMode(fetcher = globalThis.fetch?.bind(globalThis)) {
  if (mode) return Promise.resolve(mode);
  if (!detecting) {
    const wanted = requestedMode();
    detecting = (wanted !== 'auto' ? Promise.resolve(wanted)
      // Tests and non-web contexts have no page URL to probe; they always use their server stub.
      : !inBrowserPage() || !fetcher ? Promise.resolve('server')
      : probe(fetcher)).then(found => (mode = found));
  }
  return detecting;
}

export const storageMode = () => mode;
export const isLocalMode = () => mode === 'local';
export const isPersistent = () => persistent;

function newId() {
  return globalThis.crypto?.randomUUID?.() || `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function readRow(now) {
  let raw = null;
  try { raw = globalThis.localStorage.getItem(LOCAL_SAVE_KEY); persistent = true; }
  catch { persistent = false; }
  if (!persistent) return memoryRow ||= { revision: 0, document: createAccount(now, newId()) };
  if (raw) {
    try {
      const row = JSON.parse(raw);
      if (row && Number.isInteger(row.revision) && row.document?.journey) return row;
    } catch { /* fall through to a fresh account; the damaged text is kept under a backup key */ }
    try { globalThis.localStorage.setItem(`${LOCAL_SAVE_KEY}.damaged`, raw); } catch { /* best effort */ }
  }
  const row = { revision: 0, document: createAccount(now, newId()) };
  writeRow(row);
  return row;
}

function writeRow(row) {
  if (!persistent) { memoryRow = row; return; }
  try { globalThis.localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(row)); }
  catch {
    throw new AcademyError('storage_full', 'This browser has no space left to save progress. Download a backup from Settings, then free some browser storage.', 507);
  }
}

function envelope(row, now, extra = {}) {
  return {
    state: publicState(row.document, now, ACTIVITIES),
    week: getWeekStatus(row.document, now),
    serverTime: new Date(now).toISOString(),
    revision: row.revision,
    ...extra,
  };
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

/** Handles one /api/academy request against browser storage, in the Worker's response format. */
export function localAcademyRequest(init = {}) {
  const now = Date.now();
  try {
    const row = readRow(now);
    if ((init.method || 'GET').toUpperCase() === 'GET') return json(envelope(row, now));
    let payload;
    try { payload = JSON.parse(init.body); }
    catch { throw new AcademyError('invalid_json', 'The activity submission could not be read.'); }
    const journeyId = payload?.action === 'newJourney' ? newId() : undefined;
    const next = applyAction(row.document, payload, now, ACTIVITIES, { journeyId });
    const extra = { feedback: next.feedback, reward: next.reward || null, duplicate: next.duplicate };
    if (!next.changed) return json(envelope(row, now, extra));
    const saved = { revision: row.revision + 1, document: next.account };
    writeRow(saved);
    return json(envelope(saved, now, extra));
  } catch (error) {
    const safe = error instanceof AcademyError ? error
      : new AcademyError('storage_unavailable', 'This browser could not update your saved progress. Please try again.', 500);
    return json({ error: { code: safe.code, message: safe.message, ...safe.details } }, safe.status);
  }
}

/** Drop-in replacement for fetch() used by AcademyAPI: routes to the Worker or to browser storage. */
export async function academyFetch(url, init) {
  const fetcher = globalThis.fetch?.bind(globalThis);
  if ((await detectStorageMode(fetcher)) === 'local' && String(url) === ENDPOINT) return localAcademyRequest(init);
  return fetcher(apiURL(url), init);
}

export function downloadLocalBackup() {
  const row = readRow(Date.now());
  const blob = new Blob([JSON.stringify({ format: BACKUP_FORMAT, savedAt: new Date().toISOString(), ...row }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `THE_AMCOL_WAY_Browser_Save_${new Date().toISOString().slice(0, 10)}.json`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Replaces this browser's save with a backup file. Returns the restored cadet name. */
export async function restoreLocalBackup(file) {
  if (!file || file.size > 12_000_000) throw new Error('Choose a browser-save backup under 12 MB.');
  let backup;
  try { backup = JSON.parse(await file.text()); } catch { throw new Error('That file is not a THE AMCOL WAY browser save.'); }
  if (backup?.format !== BACKUP_FORMAT || !Number.isInteger(backup.revision) || !backup.document?.journey)
    throw new Error('That file is not a THE AMCOL WAY browser save. Use “Download browser save”, not the academy record export.');
  const now = Date.now();
  publicState(backup.document, now, ACTIVITIES); // throws if the rules cannot read it
  const current = readRow(now);
  // Keep the revision moving forward so open tabs accept the restored state.
  writeRow({ revision: Math.max(current.revision, backup.revision) + 1, document: backup.document });
  return backup.document.journey.profile?.name || 'your cadet';
}
