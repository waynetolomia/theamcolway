/**
 * The generated course data links its page images and PDF as "/game/...", which only works
 * when the game is served from a site root (the Cloudflare Worker). Rewriting those links to
 * this folder lets the same files run from a subfolder such as GitHub Pages or a learning hub.
 * app.js imports this module first so the data is fixed before other modules copy it.
 */
import { BOOK, UNITS, SEMESTERS, ACTIVITIES, BOOK_PAGES } from './book-course.js';

const GAME_PATH = /^\/game\/[\w./-]+$/;

function rewrite(value, base, seen) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const key of Object.keys(value)) {
    const item = value[key];
    if (typeof item === 'string') { if (GAME_PATH.test(item)) value[key] = new URL(item.slice('/game/'.length), base).href; }
    else rewrite(item, base, seen);
  }
}

if (/^https?:$/.test(globalThis.location?.protocol || '')) {
  const base = new URL('./', import.meta.url);
  // Served from /game/ already: the original absolute links are correct.
  if (base.pathname !== '/game/') {
    const seen = new WeakSet();
    for (const data of [BOOK, UNITS, SEMESTERS, ACTIVITIES, BOOK_PAGES]) rewrite(data, base, seen);
  }
}
