import { ACTIVITIES } from '../public/game/book-course.js';
import { AcademyError } from '../public/game/course-progress.js';
import { readAccount, mutateAccount, responseFor } from '../lib/academy-store.mjs';
import { createAuthenticator } from './auth.mjs';

const BODY_LIMIT = 96_000;
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  Vary: 'Cf-Access-Jwt-Assertion, Cookie',
  'X-Content-Type-Options': 'nosniff',
};

function database(env) {
  if (!env.DB) throw new AcademyError('storage_unavailable',
    'The academy is connecting to saved progress. Please try again shortly.', 503);
  return env.DB.withSession('first-primary');
}

function knownError(error) {
  if (error instanceof AcademyError) return error;
  // Do not disclose JWTs, student responses, SQL, or internal failures.
  return new AcademyError('storage_unavailable',
    'We could not confirm the academy update. Refresh or retry; repeating a sleep request will not spend another reset.', 503);
}

function apiError(error) {
  const safe = knownError(error);
  return Response.json({ error: { code: safe.code, message: safe.message, ...safe.details } },
    { status: safe.status, headers: JSON_HEADERS });
}

const escapeHTML = value => String(value).replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function pageError(error) {
  const safe = knownError(error);
  const title = safe.status === 401 ? 'Sign in to your academy' : 'Academy setup';
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · THE AMCOL WAY</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#ecf1e9;color:#173d43;font:17px/1.6 system-ui,sans-serif}main{max-width:36rem;padding:2rem}small{letter-spacing:.15em}h1{line-height:1.1;font-size:2.5rem}a{color:inherit;font-weight:700}p{max-width:34rem}</style><main><small>THE AMCOL WAY</small><h1>${title}</h1><p>${escapeHTML(safe.message)}</p><p>Use the college’s protected game address. A complete Cloudflare Access policy opens its sign-in screen before the game loads.</p><p><a href="/auth/login">Return to academy sign-in →</a></p></main></html>`;
  return new Response(html, { status: safe.status, headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'self'",
  } });
}

async function jsonBody(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    throw new AcademyError('origin_mismatch', 'Open the game directly to save progress.', 403);
  }
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') {
    throw new AcademyError('origin_mismatch', 'Open the game directly to save progress.', 403);
  }
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    throw new AcademyError('invalid_request', 'Use a JSON request for academy actions.', 415);
  }
  if (Number(request.headers.get('content-length') || 0) > BODY_LIMIT) {
    throw new AcademyError('request_too_large', 'Keep this submission under 96 KB.', 413);
  }
  // Count actual streamed bytes, including requests without Content-Length.
  let size = 0;
  const chunks = [];
  if (request.body) {
    const reader = request.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > BODY_LIMIT) {
          await reader.cancel();
          throw new AcademyError('request_too_large', 'Keep this submission under 96 KB.', 413);
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new AcademyError('invalid_json', 'The activity submission could not be read.'); }
}

export function createWorker({ authenticate = createAuthenticator(), now = () => Date.now() } = {}) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const isAPI = url.pathname === '/api/academy';
      // A top-level reload makes the protected hostname start its Access flow.
      // This route reveals no asset or account data and accepts no return URL.
      if (url.pathname === '/auth/login' && ['GET', 'HEAD'].includes(request.method)) {
        return new Response(null, { status: 303, headers: {
          Location: '/game/index.html', 'Cache-Control': 'no-store',
        } });
      }
      try {
        const userId = await authenticate(request, env);
        if (isAPI) {
          if (request.method === 'GET') {
            const serverNow = now();
            const row = await readAccount(database(env), userId, serverNow);
            return Response.json(responseFor(row, serverNow, ACTIVITIES), { headers: JSON_HEADERS });
          }
          if (request.method === 'POST') {
            const payload = await jsonBody(request);
            const result = await mutateAccount(database(env), userId, payload, now(), ACTIVITIES);
            return Response.json(result, { headers: JSON_HEADERS });
          }
          return Response.json({ error: { code: 'method_not_allowed', message: 'Use GET or POST.' } },
            { status: 405, headers: { ...JSON_HEADERS, Allow: 'GET, POST' } });
        }
        if (url.pathname.startsWith('/api/')) {
          return Response.json({ error: { code: 'not_found', message: 'This academy endpoint does not exist.' } },
            { status: 404, headers: JSON_HEADERS });
        }
        if (!['GET', 'HEAD'].includes(request.method)) {
          return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' } });
        }
        if (url.pathname === '/' || url.pathname === '/game' || url.pathname === '/game/') {
          return new Response(null, { status: 302, headers: { Location: '/game/index.html', 'Cache-Control': 'no-store' } });
        }
        if (!env.ASSETS) throw new AcademyError('assets_unavailable', 'The academy files are not available yet.', 503);
        const original = await env.ASSETS.fetch(request);
        const response = new Response(original.body, original);
        // Assets are authenticated before every request. Prevent downstream
        // shared/browser caches from serving them after the student signs out.
        response.headers.set('Cache-Control', 'private, no-store');
        response.headers.set('Vary', 'Cf-Access-Jwt-Assertion, Cookie');
        response.headers.set('X-Content-Type-Options', 'nosniff');
        response.headers.set('Referrer-Policy', 'same-origin');
        return response;
      } catch (error) { return isAPI || url.pathname.startsWith('/api/') ? apiError(error) : pageError(error); }
    },
  };
}

export default createWorker();
