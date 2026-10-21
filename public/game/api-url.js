/** Forward an explicitly selected development cadet only to this game's local APIs.
 * The Worker independently enforces DEV_MODE + ENVIRONMENT + its opt-in switch.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const GAME_APIS = new Set(['/api/academy', '/api/presence', '/api/presence/session', '/api/class-worlds']);

export function apiURL(path, page = globalThis.location) {
  if (typeof path !== 'string' || !path.startsWith('/api/') || !page) return path;
  try {
    const base = new URL(page.href || `${page.protocol}//${page.host || page.hostname}/`);
    if (!LOCAL_HOSTS.has(base.hostname) || !/^https?:$/.test(base.protocol)) return path;
    const selected = new URL(base.href);
    if (typeof page.search === 'string') selected.search = page.search;
    const user = selected.searchParams.get('dev_user');
    if (!user || !/^[A-Za-z0-9_-]{1,64}$/.test(user)) return path;
    const url = new URL(path, base);
    if (url.origin !== base.origin || !GAME_APIS.has(url.pathname)) return path;
    url.searchParams.set('dev_user', user);
    return `${url.pathname}${url.search}`;
  } catch { return path; }
}
