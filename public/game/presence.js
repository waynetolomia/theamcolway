/** Optional, ephemeral presence. This module never calls the academy progress API. */
import { apiURL } from './api-url.js';
import {
  QUICK_CHAT, EMOTES, ZONES, ROOM_CAPACITY, SNAPSHOT_INTERVAL_MS,
  normalizeClassCode, parseRoomName, clampMovement, validateClientMessage, validateServerMessage,
} from './presence-protocol.js';

const PHRASES = new Map(QUICK_CHAT.map(phrase => [phrase.id, phrase.text]));
const sameMove = (a, b) => a && b && ['x', 'z', 'yaw', 'moving', 'running'].every(key => a[key] === b[key]);
export const normalizePlayMode = value => value === 'online' ? 'online' : 'solo';
export const reconnectDelay = attempt => Math.min(30000, 1000 * 2 ** Math.min(5, Math.max(0, attempt)));

export class PresenceClient {
  constructor({
    WebSocket: Socket = globalThis.WebSocket,
    setTimeout: schedule = globalThis.setTimeout?.bind(globalThis),
    clearTimeout: cancel = globalThis.clearTimeout?.bind(globalThis),
    now = () => Date.now(), location = globalThis.location,
    eventTarget = globalThis.window, navigator = globalThis.navigator,
    getWorld = () => null, isLocalMode = () => false, onStatus = () => {},
  } = {}) {
    this.Socket = Socket; this.schedule = schedule; this.cancel = cancel; this.now = now;
    this.location = location; this.getWorld = getWorld; this.isLocalMode = isLocalMode;
    this.onStatus = onStatus;
    this.mode = 'solo'; this.zone = 'campus'; this.code = ''; this.hidden = false;
    this.players = new Map(); this.active = new Map(); this.muted = new Set();
    this._socket = null; this._wanted = false; this._attempt = 0; this._epoch = 0; this._classClosed = false;
    this._retry = null; this._handshake = null; this._moveTimer = null;
    this._pendingMove = null; this._sentMove = null; this._lastMoveAt = -Infinity;
    this._lastSocialAt = -Infinity; this._snapshotTime = -1; this._you = null;
    this._status = { state: 'solo', mode: 'solo', effectiveMode: 'solo', count: 0, room: null, hidden: false, code: '' };
    this._eventTarget = eventTarget; this._networkOffline = navigator?.onLine === false;
    this._offline = () => { this._networkOffline = true; if (this._wanted && !this._classClosed) this._lost(this._epoch); };
    this._online = () => {
      this._networkOffline = false;
      if (this._wanted && !this.connected && !this._classClosed) { this._drop(); this._open(); }
    };
    eventTarget?.addEventListener?.('offline', this._offline);
    eventTarget?.addEventListener?.('online', this._online);
  }

  get status() { return { ...this._status }; }
  get connected() { return this._status.state === 'online' && this._socket?.readyState === 1; }
  getPlayer(k) { const player = this.players.get(k); return player ? { ...player, muted: this.muted.has(k) } : null; }
  isMuted(k) { return this.muted.has(k); }

  _world(method, ...args) {
    // A rendering problem must never escape into saves, dialogs or the game loop.
    try { return this.getWorld()?.[method]?.(...args); } catch { return undefined; }
  }

  _emit(state = this._status.state, extra = {}) {
    this._status = {
      ...this._status, state, mode: this.mode, effectiveMode: state === 'online' ? 'online' : 'solo',
      hidden: this.hidden, code: this.code, ...extra,
    };
    try { this.onStatus(this.status); } catch { /* UI is independent from transport. */ }
  }

  connect({ zone = this.zone, code = this.code, hidden = this.hidden } = {}) {
    if (this.isLocalMode()) { this.disconnect(); return false; }
    const normalized = code ? normalizeClassCode(code) : '';
    if (!ZONES.includes(zone) || normalized === null) return false;
    const changed = zone !== this.zone || normalized !== this.code;
    this.zone = zone; this.code = normalized; this.setHidden(hidden);
    this.mode = 'online'; this._wanted = true;
    if (changed) this._drop();
    if (!this._socket && this._retry === null) this._open();
    return true;
  }

  disconnect() {
    this._wanted = false; this.mode = 'solo'; this._attempt = 0; this._classClosed = false;
    this._drop(); this._emit('solo', { count: 0, room: null });
  }

  setZone(zone) {
    if (!ZONES.includes(zone)) return false;
    if (zone === this.zone) return true;
    this.zone = zone; this._attempt = 0; this._drop();
    if (this._wanted) this._open();
    return true;
  }

  setClassCode(value) {
    const code = value ? normalizeClassCode(value) : '';
    if (code === null) return false;
    if (code === this.code) return true;
    this.code = code; this._attempt = 0; this._classClosed = false; this._drop();
    if (this._wanted) this._open(); else this._emit();
    return true;
  }

  /** An explicit retry may revisit a closed code; network events never do. */
  retry() {
    if (!this._wanted || this.isLocalMode()) return false;
    this._classClosed = false; this._attempt = 0; this._drop(); this._open(); return true;
  }

  setHidden(hidden) {
    const next = hidden === true;
    if (next === this.hidden) return;
    this.hidden = next;
    if (this._socket?.readyState === 1) this._send({ type: 'hide', hidden: next });
    this._emit();
  }

  _drop() {
    this._epoch++;
    for (const key of ['_retry', '_handshake', '_moveTimer']) {
      if (this[key] !== null) this.cancel?.(this[key]);
      this[key] = null;
    }
    const socket = this._socket; this._socket = null;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      try { socket.close(1000, 'Leaving room'); } catch { /* Already disconnected. */ }
    }
    this._you = null; this._snapshotTime = -1; this._pendingMove = this._sentMove = null;
    this._lastMoveAt = -Infinity;
    this.players.clear(); this.active.clear(); this._world('clearRemotePlayers');
  }

  _url() {
    const page = this.location;
    const base = new URL(page?.href || `${page?.protocol}//${page?.host || page?.hostname}/`);
    if (!/^https?:$/.test(base.protocol)) throw new Error('Online play needs the college version.');
    const path = `/api/presence?zone=${encodeURIComponent(this.zone)}${this.code ? `&code=${encodeURIComponent(this.code)}` : ''}`;
    const url = new URL(apiURL(path, page), base);
    url.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.href;
  }

  _open() {
    if (!this._wanted || this.isLocalMode()) { if (this.isLocalMode()) this.disconnect(); return; }
    if (this._classClosed) return;
    this._emit(this._attempt ? 'reconnecting' : 'connecting', { count: 0, room: null });
    const epoch = ++this._epoch;
    if (this._networkOffline) { this._lost(epoch); return; }
    let socket;
    try { socket = new this.Socket(this._url()); } catch { this._lost(epoch); return; }
    this._socket = socket;
    const current = () => this._wanted && this._epoch === epoch && this._socket === socket;
    socket.onopen = () => {
      if (!current()) return;
      this._send({ type: 'hello', mode: 'online', hidden: this.hidden });
    };
    socket.onmessage = event => {
      if (!current()) return;
      const message = validateServerMessage(event.data);
      if (message) this._receive(message);
    };
    socket.onerror = () => { if (current()) this._lost(epoch); };
    socket.onclose = event => {
      if (!current()) return;
      if (event?.code === 4003 && this.code) {
        this._drop(); this._classClosed = true;
        this._emit('class-closed', { count: 0, room: null });
      } else this._lost(epoch);
    };
    this._handshake = this.schedule?.(() => { if (current() && !this.connected) this._lost(epoch); }, 10000) ?? null;
  }

  _lost(epoch) {
    if (epoch !== this._epoch || !this._wanted) return;
    this._drop(); this._emit('reconnecting', { count: 0, room: null });
    const wait = reconnectDelay(this._attempt++);
    this._retry = this.schedule?.(() => { this._retry = null; if (this._wanted) this._open(); }, wait) ?? null;
  }

  _send(message) {
    const socket = this._socket;
    if (!this._wanted || socket?.readyState !== 1 || socket.bufferedAmount > 4096) return false;
    const raw = JSON.stringify(message);
    if (!validateClientMessage(raw)) return false;
    try { socket.send(raw); return true; }
    catch { this._lost(this._epoch); return false; }
  }

  _receive(message) {
    if (message.type === 'welcome') {
      if (this._you) return;
      const room = parseRoomName(message.room);
      if (room.zone !== this.zone || room.code !== (this.code || null)) return;
      this._you = message.you; this._attempt = 0;
      if (this._handshake !== null) this.cancel?.(this._handshake);
      this._handshake = null;
      this._emit('online', { room: message.room, count: 0 });
      const state = this._world('getPresenceState');
      if (state) this.move(state);
      return;
    }
    if (!this._you) return;
    if (message.type === 'join') {
      if (message.k === this._you || !this.players.has(message.k) && this.players.size >= ROOM_CAPACITY) return;
      const player = { ...message, label: `${message.name} · ${message.major.toUpperCase()} · Y${message.year}` };
      this.players.set(message.k, player);
      if (this.active.has(message.k)) this._world('addRemotePlayer', message.k, player.look, player.label);
    } else if (message.type === 'leave') {
      this.players.delete(message.k); this.active.delete(message.k);
      this._world('removeRemotePlayer', message.k); this._emit('online', { count: this.active.size });
    } else if (message.type === 'snapshot') {
      if (message.t <= this._snapshotTime) return;
      this._snapshotTime = message.t;
      const next = new Map();
      for (const state of message.players) {
        const player = this.players.get(state.k);
        if (!player || state.k === this._you) continue;
        next.set(state.k, { ...state, t: message.t });
        if (!this.active.has(state.k)) this._world('addRemotePlayer', state.k, player.look, player.label);
        this._world('updateRemotePlayer', state.k, { ...state, t: message.t });
      }
      for (const k of this.active.keys()) if (!next.has(k)) this._world('removeRemotePlayer', k);
      this.active = next; this._emit('online', { count: next.size });
    } else if (!this.muted.has(message.k) && this.active.has(message.k)) {
      if (message.type === 'say') this._world('showRemoteBubble', message.k, PHRASES.get(message.phraseId));
      if (message.type === 'emote') this._world('playRemoteGesture', message.k, message.id);
    }
  }

  /** Called by the world's light movement hook, including a final stopped state. */
  move(state) {
    if (!this._wanted || !state || typeof state.moving !== 'boolean' || typeof state.running !== 'boolean') return false;
    const value = clampMovement(state, this.zone);
    if (!value) return false;
    this._pendingMove = value;
    if (this.connected) this._flushMove();
    return true;
  }

  _flushMove() {
    if (!this.connected || !this._pendingMove || sameMove(this._pendingMove, this._sentMove)) return;
    const remaining = SNAPSHOT_INTERVAL_MS - (this.now() - this._lastMoveAt);
    if (remaining > 0) {
      if (this._moveTimer === null) this._moveTimer = this.schedule?.(() => { this._moveTimer = null; this._flushMove(); }, remaining) ?? null;
      return;
    }
    const state = this._pendingMove;
    if (this._send({ type: 'move', ...state })) {
      this._sentMove = state; this._lastMoveAt = this.now();
    } else if (this.connected && this._moveTimer === null) {
      this._moveTimer = this.schedule?.(() => { this._moveTimer = null; this._flushMove(); }, SNAPSHOT_INTERVAL_MS) ?? null;
    }
  }

  _social(message) {
    if (!this.connected || this.hidden || this.now() - this._lastSocialAt < 2000) return false;
    if (!this._send(message)) return false;
    this._lastSocialAt = this.now(); return true;
  }

  sendEmote(id) { return EMOTES.includes(id) && this._social({ type: 'emote', id }); }
  say(phraseId) { return PHRASES.has(phraseId) && this._social({ type: 'say', phraseId }); }
  refresh() { return this.connected && this._send({ type: 'refresh' }); }

  mute(k) {
    if (!this.players.has(k) || k === this._you) return false;
    this.muted.add(k);
    this._world('showRemoteBubble', k, ''); this._world('cancelRemoteGesture', k);
    this._send({ type: 'mute', userKey: k });
    return true;
  }

  report(k) { return this.players.has(k) && k !== this._you && this._send({ type: 'report', userKey: k }); }

  syncWorld() {
    for (const [k, state] of this.active) {
      const player = this.players.get(k);
      if (player) { this._world('addRemotePlayer', k, player.look, player.label); this._world('updateRemotePlayer', k, state); }
    }
  }

  destroy() {
    this.disconnect(); this.muted.clear();
    this._eventTarget?.removeEventListener?.('offline', this._offline);
    this._eventTarget?.removeEventListener?.('online', this._online);
  }
}

export const createPresence = options => new PresenceClient(options);
