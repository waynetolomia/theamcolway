import { AcademyError } from '../public/game/course-progress.js';
import {
  MAX_CLIENT_MESSAGE_BYTES, MAX_SERVER_MESSAGE_BYTES, ROOM_CAPACITY, MAX_ROOM_INSTANCES,
  SNAPSHOT_INTERVAL_MS, MAX_SNAPSHOT_PLAYERS, NEARBY_RADIUS, ZONE_CONFIG, ZONES,
  clampMovement, isUserKey, normalizeClassCode, parseRoomName, roomName, utf8ByteLength, validateClientMessage,
} from '../public/game/presence-protocol.js';
import { loadPresenceProfile, recordPresenceReport, requireOpenClassWorld } from '../lib/presence-store.mjs';

export { MAX_ROOM_INSTANCES } from '../public/game/presence-protocol.js';

const INTERNAL_ORIGIN = 'https://presence.internal';
export const PRESENCE_USER_HEADER = 'X-Amcol-User-ID';
export const PRESENCE_ROOM_HEADER = 'X-Amcol-Room';
const FULL_HEADER = 'X-Amcol-Room-Full';
const HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const unavailable = () => new AcademyError('presence_unavailable', 'Online play is connecting. You can keep playing solo.', 503);
const closed = () => new AcademyError('class_unavailable', 'This class world is closed. Leave its code to join the public world.', 404);
const validUser = value => typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f]/u.test(value);
const database = env => {
  if (!env.DB?.withSession) throw unavailable();
  return env.DB.withSession('first-primary');
};
const stubFor = (env, name) => env.PRESENCE_ROOMS.get(env.PRESENCE_ROOMS.idFromName(name));
const errorResponse = error => {
  const safe = error instanceof AcademyError ? error : unavailable();
  return Response.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status, headers: HEADERS });
};

/**
 * The Worker has already checked Access and same-origin before calling here.
 * Construct fresh requests so no browser-provided identity/header can survive.
 * Full rooms are probed lower-first. Each room alone owns its atomic admission.
 */
export async function joinPresenceRoom(env, { userId, zone, code = null }) {
  if (!env.PRESENCE_ROOMS) throw unavailable();
  if (!validUser(userId)) throw new AcademyError('sign_in_required', 'Sign in to join online play.', 401);
  if (!ZONES.includes(zone)) throw new AcademyError('invalid_zone', 'Choose campus, dorm or Atlantic.', 400);
  if (code !== null) {
    code = normalizeClassCode(code);
    if (!code) throw closed();
    await requireOpenClassWorld(database(env), code);
  }
  for (let instance = 0; instance < MAX_ROOM_INSTANCES; instance++) {
    const name = roomName(zone, instance, code);
    const request = new Request(`${INTERNAL_ORIGIN}/connect`, { headers: {
      Upgrade: 'websocket', [PRESENCE_USER_HEADER]: encodeURIComponent(userId), [PRESENCE_ROOM_HEADER]: name,
    } });
    const response = await stubFor(env, name).fetch(request);
    if (response.status !== 409 || response.headers.get(FULL_HEADER) !== '1') return response;
    await response.body?.cancel();
  }
  throw new AcademyError('presence_busy', 'This world is busy. You can keep playing solo while online play retries.', 503);
}

/** Close all bounded room instances, including gaps left by departed students. */
export async function closeClassRooms(env, input) {
  if (!env.PRESENCE_ROOMS) throw unavailable();
  const code = normalizeClassCode(input);
  if (!code) throw closed();
  const names = ZONES.flatMap(zone => Array.from({ length: MAX_ROOM_INSTANCES }, (_, instance) => roomName(zone, instance, code)));
  let failed = false;
  // Free Workers allow 1,000 internal service subrequests. Keep open requests
  // below the six simultaneous-connection limit and consume each response.
  for (let start = 0; start < names.length; start += 6) {
    const results = await Promise.allSettled(names.slice(start, start + 6).map(async name => {
      const response = await stubFor(env, name).fetch(new Request(`${INTERNAL_ORIGIN}/close`, {
        method: 'POST', headers: { [PRESENCE_ROOM_HEADER]: name },
      }));
      await response.body?.cancel();
      if (!response.ok) throw unavailable();
    }));
    // Complete other batches too. The D1 code is already closed, so an operator
    // can safely retry this idempotent cleanup if any binding request fails.
    if (results.some(result => result.status === 'rejected')) failed = true;
  }
  if (failed) throw unavailable();
}

function randomKey() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(9))))
    .replace(/\+/g, '-').replace(/\//g, '_');
}

function snapshotFingerprint(text) {
  // Two independent 32-bit accumulators avoid storing an entire snapshot in
  // each hibernation attachment. This is a change detector, not an identity.
  let first = 2166136261, second = 5381;
  for (let index = 0; index < text.length; index++) {
    const character = text.charCodeAt(index);
    first = Math.imul(first ^ character, 16777619) >>> 0;
    second = (Math.imul(second, 33) ^ character) >>> 0;
  }
  return `${first.toString(16)}:${second.toString(16)}:${text.length}`;
}

const distanceSquared = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const wireState = session => ({ k: session.k, x: session.x, z: session.z, yaw: session.yaw, moving: session.moving, running: session.running });

/** Pure selection helper used by the room and deterministic offline load tests. */
export function nearbyPlayers(viewer, sessions) {
  return Array.from(sessions).filter(other => other.k !== viewer.k && other.ready && !other.hidden &&
    distanceSquared(viewer, other) <= NEARBY_RADIUS ** 2)
    .sort((a, b) => distanceSquared(viewer, a) - distanceSquared(viewer, b) || a.k.localeCompare(b.k))
    .slice(0, MAX_SNAPSHOT_PLAYERS);
}

/**
 * Hibernating Durable Object. A plain exported class also imports in Node's
 * offline tests; the production runtime supplies the normal ctx/env pair.
 */
export class PresenceRoom {
  constructor(ctx, env, runtime = {}) {
    this.ctx = ctx;
    this.env = env;
    this.now = runtime.now || (() => Date.now());
    this.schedule = runtime.setTimeout || ((callback, delay) => setTimeout(callback, delay));
    this.cancel = runtime.clearTimeout || (timer => clearTimeout(timer));
    this.createPair = runtime.createPair || (() => Object.values(new WebSocketPair()));
    this.upgradeResponse = runtime.upgradeResponse || (client => new Response(null, { status: 101, webSocket: client }));
    this.makeKey = runtime.makeKey || randomKey;
    this.sessions = new Map();
    this.refreshes = new Map();
    this.room = null;
    this.timer = null;
    this.dirty = false;
    this.closed = false;
    this.lastFlushAt = this.now();
    for (const ws of ctx.getWebSockets()) {
      if (ws.readyState !== 1) continue;
      const session = ws.deserializeAttachment();
      if (session?.version === 1 && isUserKey(session.k) && parseRoomName(session.room) && validUser(session.userId)) {
        this.sessions.set(ws, session);
        this.room ||= session.room;
      } else {
        try { ws.close(1011, 'Reconnect to online play'); } catch {}
      }
    }
    // A normal pending refresh timer/read prevents hibernation. Retain the
    // pending bit as well, so reconstruction cannot discard a requested update.
    for (const [ws, session] of this.sessions) if (session.refreshPending) this._queueRefresh(ws, true);
    // No recurring timer, alarm or constructor write: clean rooms may hibernate.
  }

  async fetch(request) {
    try {
      const url = new URL(request.url), name = request.headers.get(PRESENCE_ROOM_HEADER);
      const info = parseRoomName(name);
      if (url.origin !== INTERNAL_ORIGIN || !info || (this.room && this.room !== name)) {
        throw new AcademyError('invalid_presence_request', 'This online request could not be read.', 400);
      }
      this.room = name;
      if (url.pathname === '/close' && request.method === 'POST' && info.code) {
        // The Worker has already closed D1. This flag also blocks admissions
        // whose profile/class reads were in flight when close reached this DO.
        this.closed = true;
        const count = this.sessions.size;
        for (const ws of [...this.sessions.keys()]) this._drop(ws, 4003, 'Class world closed');
        return Response.json({ closed: true, count }, { headers: HEADERS });
      }
      if (url.pathname !== '/connect' || request.method !== 'GET' || request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
        throw new AcademyError('upgrade_required', 'Use an online play connection.', 426);
      }
      let userId;
      try { userId = decodeURIComponent(request.headers.get(PRESENCE_USER_HEADER) || ''); } catch {}
      if (!validUser(userId)) throw new AcademyError('sign_in_required', 'Sign in to join online play.', 401);
      if (this.closed) throw closed();
      if (this.sessions.size >= ROOM_CAPACITY) return this._full();
      const db = database(this.env);
      const [profile] = await Promise.all([
        loadPresenceProfile(db, userId),
        ...(info.code ? [requireOpenClassWorld(db, info.code)] : []),
      ]);

      // This check and accept are synchronous, after every asynchronous read.
      // Interleaving D1 requests therefore cannot overbook the 100th slot.
      if (this.closed) throw closed();
      if (this.sessions.size >= ROOM_CAPACITY) return this._full();
      let k;
      do { k = this.makeKey(); } while ([...this.sessions.values()].some(other => other.k === k));
      const [client, server] = this.createPair();
      const session = {
        version: 1, userId, k, room: name, zone: info.zone, profile, profileVersion: 1,
        ...ZONE_CONFIG[info.zone].spawn, yaw: 0, moving: false, running: false,
        ready: false, hidden: true, moveTimes: [], socialAt: null, refreshAt: null, refreshPending: false, reportAt: null,
        muted: [], reported: [], known: {}, snapshotHash: null,
      };
      this.ctx.acceptWebSocket(server);
      this.sessions.set(server, session);
      this._persist(server, session);
      this._send(server, { type: 'welcome', you: k, room: name, count: this.sessions.size });
      return this.upgradeResponse(client);
    } catch (error) { return errorResponse(error); }
  }

  _full() {
    return Response.json({ error: { code: 'room_full', message: 'Trying the next room.' } },
      { status: 409, headers: { ...HEADERS, [FULL_HEADER]: '1' } });
  }

  _persist(ws, session) {
    if (this.sessions.get(ws) === session) ws.serializeAttachment(session);
  }

  _send(ws, message) {
    if (!this.sessions.has(ws)) return false;
    const encoded = JSON.stringify(message);
    if (utf8ByteLength(encoded) >= MAX_SERVER_MESSAGE_BYTES) {
      this._drop(ws, 1011, 'Reconnect to online play');
      return false;
    }
    try { ws.send(encoded); return true; }
    catch { this._drop(ws, 1011, 'Reconnect to online play'); return false; }
  }

  _markDirty() {
    this.dirty = true;
    if (this.timer === null && this.sessions.size) {
      const delay = Math.max(1, SNAPSHOT_INTERVAL_MS - (this.now() - this.lastFlushAt));
      this.timer = this.schedule(() => { this.timer = null; this._flush(); }, delay);
    }
  }

  _queueRefresh(ws, defer = false) {
    const session = this.sessions.get(ws);
    if (!session?.refreshPending) return;
    let task = this.refreshes.get(ws);
    if (!task) {
      task = { timer: null, inFlight: false };
      this.refreshes.set(ws, task);
    }
    if (task.inFlight || task.timer !== null) return;
    const delay = session.refreshAt === null ? 0 : Math.max(0, 1000 - (this.now() - session.refreshAt));
    if (delay > 0 || defer) {
      task.timer = this.schedule(() => {
        task.timer = null;
        const work = this._readRefresh(ws, task);
        this.ctx.waitUntil?.(work);
        return work;
      }, Math.max(1, delay));
      return;
    }
    return this._readRefresh(ws, task);
  }

  async _readRefresh(ws, task) {
    const session = this.sessions.get(ws);
    if (!session?.refreshPending || this.refreshes.get(ws) !== task) return;
    task.inFlight = true;
    session.refreshPending = false;
    session.refreshAt = this.now();
    this._persist(ws, session);
    try {
      const profile = await loadPresenceProfile(database(this.env), session.userId);
      if (this.sessions.get(ws) !== session) return;
      if (JSON.stringify(profile) !== JSON.stringify(session.profile)) {
        session.profile = profile;
        session.profileVersion++;
        this._persist(ws, session);
        this._markDirty();
      }
    } catch { this._drop(ws, 1011, 'Reconnect to refresh your cadet'); }
    finally {
      task.inFlight = false;
      if (this.refreshes.get(ws) === task) {
        if (session.refreshPending) {
          // Coalesce any number of refresh requests during a read/cooldown into
          // one trailing read. Do not keep a recursive promise chain alive.
          const work = this._queueRefresh(ws);
          if (work) this.ctx.waitUntil?.(work);
        } else {
          this.refreshes.delete(ws);
        }
      }
    }
  }

  _flush() {
    if (!this.dirty) return;
    this.dirty = false;
    const t = this.now();
    this.lastFlushAt = t;
    const candidates = [...this.sessions.values()];
    for (const [ws, viewer] of this.sessions) {
      if (!viewer.ready) continue;
      const nearby = nearbyPlayers(viewer, candidates);
      for (const other of nearby) {
        if (viewer.known[other.k] !== other.profileVersion && this._send(ws, { type: 'join', k: other.k, ...other.profile })) {
          viewer.known[other.k] = other.profileVersion;
        }
      }
      const players = nearby.map(wireState);
      // Quantization normally leaves >400 bytes of headroom even at 40 peers;
      // keep the cap explicit if the wire representation changes in the future.
      while (utf8ByteLength(JSON.stringify({ type: 'snapshot', t, players })) >= MAX_SERVER_MESSAGE_BYTES) players.pop();
      const fingerprint = snapshotFingerprint(JSON.stringify(players));
      if (viewer.snapshotHash !== fingerprint && this._send(ws, { type: 'snapshot', t, players })) {
        viewer.snapshotHash = fingerprint;
      }
      this._persist(ws, viewer);
    }
    // Dirty changes arriving during a later event schedule their own batch.
    // There is no idle interval keeping this Durable Object in memory.
  }

  _unpublish(session) {
    for (const [ws, other] of this.sessions) {
      if (Object.hasOwn(other.known, session.k)) {
        delete other.known[session.k];
        // A leave removes the client's active avatar. If this cadet returns
        // before the next batch, identical coordinates still need a snapshot.
        other.snapshotHash = null;
        this._send(ws, { type: 'leave', k: session.k });
        this._persist(ws, other);
      }
    }
  }

  _drop(ws, code = 1000, reason = 'Left online play') {
    const session = this.sessions.get(ws);
    if (!session) return;
    // A batch may already hold this object in its candidate list. Mark it
    // inactive before removal so later recipients cannot reannounce it.
    session.ready = false;
    this.sessions.delete(ws);
    const refresh = this.refreshes.get(ws);
    if (refresh?.timer !== null && refresh?.timer !== undefined) this.cancel(refresh.timer);
    this.refreshes.delete(ws);
    try { ws.close(code, reason); } catch {}
    this._unpublish(session);
    for (const [otherWS, other] of this.sessions) {
      other.muted = other.muted.filter(key => key !== session.k);
      other.reported = other.reported.filter(key => key !== session.k);
      this._persist(otherWS, other);
    }
    if (this.sessions.size) this._markDirty();
    else {
      if (this.timer !== null) this.cancel(this.timer);
      this.timer = null;
      this.dirty = false;
    }
  }

  async webSocketMessage(ws, raw) {
    const session = this.sessions.get(ws);
    if (!session) return;
    if (typeof raw !== 'string') {
      this._drop(ws, raw?.byteLength > MAX_CLIENT_MESSAGE_BYTES ? 1009 : 1003, 'Use a small JSON message');
      return;
    }
    if (raw.length > MAX_CLIENT_MESSAGE_BYTES || utf8ByteLength(raw) > MAX_CLIENT_MESSAGE_BYTES) {
      this._drop(ws, 1009, 'Keep messages under 512 bytes');
      return;
    }
    const message = validateClientMessage(raw);
    if (!message) return;
    const now = this.now();
    if (message.type === 'hello') {
      if (message.mode === 'solo') { this._drop(ws); return; }
      const changed = !session.ready || session.hidden !== message.hidden;
      if (!session.hidden && message.hidden) this._unpublish(session);
      session.ready = true;
      session.hidden = message.hidden;
      this._persist(ws, session);
      if (changed) this._markDirty();
      return;
    }
    if (!session.ready) return;
    if (message.type === 'move') {
      session.moveTimes = session.moveTimes.filter(time => now - time < 1000);
      if (session.moveTimes.length >= 10) return;
      session.moveTimes.push(now);
      const next = clampMovement(message, session.zone);
      const changed = Object.keys(next).some(key => next[key] !== session[key]);
      Object.assign(session, next);
      this._persist(ws, session);
      if (changed) this._markDirty();
      return;
    }
    if (message.type === 'hide') {
      if (session.hidden === message.hidden) return;
      if (message.hidden) this._unpublish(session);
      session.hidden = message.hidden;
      this._persist(ws, session);
      this._markDirty();
      return;
    }
    if (message.type === 'mute') {
      if (Object.hasOwn(session.known, message.userKey) && !session.muted.includes(message.userKey)) {
        session.muted.push(message.userKey);
        this._persist(ws, session);
      }
      return;
    }
    if (message.type === 'say' || message.type === 'emote') {
      if (session.hidden || (session.socialAt !== null && now - session.socialAt < 2000)) return;
      session.socialAt = now;
      this._persist(ws, session);
      for (const [otherWS, other] of this.sessions) {
        if (other.k !== session.k && other.ready && !other.muted.includes(session.k) &&
            Object.hasOwn(other.known, session.k) && distanceSquared(other, session) <= NEARBY_RADIUS ** 2) {
          this._send(otherWS, message.type === 'say' ? { type: 'say', k: session.k, phraseId: message.phraseId } :
            { type: 'emote', k: session.k, id: message.id });
        }
      }
      return;
    }
    if (message.type === 'refresh') {
      session.refreshPending = true;
      this._persist(ws, session);
      return this._queueRefresh(ws);
    }
    if (message.type === 'report') {
      const target = [...this.sessions.values()].find(other => other.k === message.userKey && other.ready && !other.hidden);
      if (!target || target.userId === session.userId || !Object.hasOwn(session.known, target.k) || session.reported.includes(target.k) ||
          (session.reportAt !== null && now - session.reportAt < 5000)) return;
      session.reportAt = now;
      session.reported.push(target.k);
      this._persist(ws, session);
      try {
        await recordPresenceReport(database(this.env), { reporterId: session.userId, reportedId: target.userId, room: session.room, now });
      } catch { this._drop(ws, 1011, 'Reconnect to online play'); }
    }
  }

  webSocketClose(ws) { this._drop(ws); }
  webSocketError(ws) { this._drop(ws, 1011, 'Reconnect to online play'); }
}
