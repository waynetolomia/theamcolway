/** Shared, browser-safe presence vocabulary and wire validation. No progress rules. */
import { CAMPUS, DORM, ATLANTIC } from './campus.js';

// The limits are directional: small client commands, bounded server snapshots.
export const MAX_CLIENT_MESSAGE_BYTES = 512;
export const MAX_SERVER_MESSAGE_BYTES = 4096;
export const ROOM_CAPACITY = 100;
export const MAX_ROOM_INSTANCES = 32;
export const SNAPSHOT_INTERVAL_MS = 125;
export const NEARBY_RADIUS = 40;
export const MAX_SNAPSHOT_PLAYERS = 40;
export const ZONES = Object.freeze(['campus', 'dorm', 'atlantic']);
export const ZONE_CONFIG = Object.freeze({ campus: CAMPUS, dorm: DORM, atlantic: ATLANTIC });
export const CLASS_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const EMOTES = Object.freeze(['wave', 'salute', 'thumbs-up', 'cheer']);
export const QUICK_CHAT = Object.freeze([
  ['hello', 'Hello, cadet!'],
  ['good-morning', 'Good morning!'],
  ['say-again', 'Say again, please.'],
  ['stand-by', 'Stand by.'],
  ['follow-me', 'Follow me.'],
  ['meet-dome', 'Meet me at the Dome.'],
  ['meet-atlantic', 'Meet me at the Atlantic Building.'],
  ['ready-study', 'Ready to study?'],
  ['well-done', 'Well done!'],
  ['thank-you', 'Thank you.'],
  ['roger', 'Roger.'],
  ['over-and-out', 'Over and out.'],
].map(([id, text]) => Object.freeze({ id, text })));
const PHRASE_IDS = new Set(QUICK_CHAT.map(phrase => phrase.id));
const KEY_PATTERN = /^[A-Za-z0-9_-]{12}$/;
const CLASS_PATTERN = /^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/;
const LOOK_OPTIONS = Object.freeze({
  gender: ['male', 'female'], major: ['deck', 'engine'],
  hairStyle: ['crop', 'swept', 'bob', 'bun'], uniformBottom: ['pants', 'skirt'],
  outfit: ['cadet', 'coverall', 'immersion', 'maritime', 'maritime-white'],
  body: ['slim', 'regular', 'broad'], accessory: ['none', 'glasses', 'cap'],
});
const LOOK_COLORS = ['skin', 'hairColor', 'accent'];
export function utf8ByteLength(value) {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0);
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}
export const isUserKey = value => typeof value === 'string' && KEY_PATTERN.test(value);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, fields) => record(value) && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const boolean = value => typeof value === 'boolean';

export function normalizeClassCode(value) {
  if (typeof value !== 'string' || value.length > 32) return null;
  const raw = value.trim().toUpperCase();
  const code = raw.length === 6 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw;
  return CLASS_PATTERN.test(code) ? code : null;
}

export function roomName(zone, instance = 0, code = null) {
  if (!ZONES.includes(zone) || !Number.isInteger(instance) || instance < 0 || instance >= MAX_ROOM_INSTANCES ||
      (code !== null && normalizeClassCode(code) !== code)) return null;
  return code ? `class:${code}:${zone}:${instance}` : `public:${zone}:${instance}`;
}

export function parseRoomName(value) {
  if (typeof value !== 'string') return null;
  const parts = value.split(':');
  const isClass = parts[0] === 'class';
  if (isClass ? parts.length !== 4 : parts.length !== 3 || parts[0] !== 'public') return null;
  const code = isClass ? normalizeClassCode(parts[1]) : null;
  if (isClass && code !== parts[1]) return null;
  const zone = parts[isClass ? 2 : 1], rawInstance = parts[isClass ? 3 : 2];
  const instance = Number(rawInstance);
  return String(instance) === rawInstance && roomName(zone, instance, code) === value ? { zone, instance, code } : null;
}

const rounded = value => Math.round(value * 100) / 100 || 0;
export function clampMovement(value, zone) {
  const bounds = ZONE_CONFIG[zone]?.bounds;
  if (!bounds || !finite(value.x) || !finite(value.z) || !finite(value.yaw)) return null;
  const yaw = ((value.yaw % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  return {
    x: rounded(Math.max(bounds.minX, Math.min(bounds.maxX, value.x))),
    z: rounded(Math.max(bounds.minZ, Math.min(bounds.maxZ, value.z))),
    yaw: rounded(yaw), moving: value.moving === true, running: value.running === true,
  };
}

/** Returns only the fields needed to draw an avatar, never a whole account/profile. */
export function validateLook(value) {
  const keys = [...Object.keys(LOOK_OPTIONS), ...LOOK_COLORS];
  if (!exact(value, keys)) return null;
  const look = {};
  for (const [key, options] of Object.entries(LOOK_OPTIONS)) {
    if (!options.includes(value[key])) return null;
    look[key] = value[key];
  }
  for (const key of LOOK_COLORS) {
    if (typeof value[key] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value[key])) return null;
    look[key] = value[key].toLowerCase();
  }
  return look;
}

function parse(raw, limit) {
  if (typeof raw !== 'string' || raw.length > limit || utf8ByteLength(raw) > limit) return null;
  try { const value = JSON.parse(raw); return record(value) ? value : null; }
  catch { return null; }
}

export function validateClientMessage(raw) {
  const value = parse(raw, MAX_CLIENT_MESSAGE_BYTES);
  if (!value || typeof value.type !== 'string') return null;
  switch (value.type) {
    case 'hello': return exact(value, ['type', 'mode', 'hidden']) && ['solo', 'online'].includes(value.mode) && boolean(value.hidden) ? value : null;
    case 'move': return exact(value, ['type', 'x', 'z', 'yaw', 'moving', 'running']) &&
      finite(value.x) && finite(value.z) && finite(value.yaw) && boolean(value.moving) && boolean(value.running) ? value : null;
    case 'emote': return exact(value, ['type', 'id']) && EMOTES.includes(value.id) ? value : null;
    case 'say': return exact(value, ['type', 'phraseId']) && PHRASE_IDS.has(value.phraseId) ? value : null;
    case 'hide': return exact(value, ['type', 'hidden']) && boolean(value.hidden) ? value : null;
    case 'mute':
    case 'report': return exact(value, ['type', 'userKey']) && isUserKey(value.userKey) ? value : null;
    case 'refresh': return exact(value, ['type']) ? value : null;
    default: return null;
  }
}

export function validateServerMessage(raw) {
  // Every server message, including a 40-player snapshot, is strictly below 4 KiB.
  const value = parse(raw, MAX_SERVER_MESSAGE_BYTES - 1);
  if (!value || typeof value.type !== 'string') return null;
  switch (value.type) {
    case 'welcome': return exact(value, ['type', 'you', 'room', 'count']) && isUserKey(value.you) && parseRoomName(value.room) &&
      Number.isInteger(value.count) && value.count >= 1 && value.count <= ROOM_CAPACITY ? value : null;
    case 'join': {
      if (!exact(value, ['type', 'k', 'name', 'look', 'major', 'year']) || !isUserKey(value.k) ||
          typeof value.name !== 'string' || !value.name.trim() || Array.from(value.name).length > 28 ||
          /[\u0000-\u001f\u007f@]/u.test(value.name) || !['deck', 'engine'].includes(value.major) ||
          !Number.isInteger(value.year) || value.year < 1 || value.year > 4) return null;
      const look = validateLook(value.look);
      return look && look.major === value.major ? { ...value, look } : null;
    }
    case 'leave': return exact(value, ['type', 'k']) && isUserKey(value.k) ? value : null;
    case 'emote': return exact(value, ['type', 'k', 'id']) && isUserKey(value.k) && EMOTES.includes(value.id) ? value : null;
    case 'say': return exact(value, ['type', 'k', 'phraseId']) && isUserKey(value.k) && PHRASE_IDS.has(value.phraseId) ? value : null;
    case 'snapshot': {
      if (!exact(value, ['type', 't', 'players']) || !Number.isSafeInteger(value.t) || value.t < 0 ||
          !Array.isArray(value.players) || value.players.length > MAX_SNAPSHOT_PLAYERS) return null;
      const seen = new Set();
      for (const player of value.players) {
        if (!exact(player, ['k', 'x', 'z', 'yaw', 'moving', 'running']) || !isUserKey(player.k) || seen.has(player.k) ||
            !finite(player.x) || Math.abs(player.x) > 38 || !finite(player.z) || Math.abs(player.z) > 25 ||
            !finite(player.yaw) || Math.abs(player.yaw) > 3.15 || !boolean(player.moving) || !boolean(player.running)) return null;
        seen.add(player.k);
      }
      return value;
    }
    default: return null;
  }
}
