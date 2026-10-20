/** Server-authoritative account progress. There is intentionally no offline write queue. */
import { academyFetch } from './local-academy.js';

export class AcademyAPIError extends Error {
  constructor(code, message, status = 0, details = {}) {
    super(message); this.name = 'AcademyAPIError'; this.code = code; this.status = status; this.details = details;
  }
}

export class AcademyAPI {
  constructor({ onState = null, onError = null, endpoint = '/api/academy', fetcher = academyFetch } = {}) {
    this.endpoint = endpoint; this.onState = onState; this.onError = onError; this.fetcher = fetcher;
    this.state = null; this.week = null; this.serverTime = null; this.revision = -1;
    this._pendingSleep = null;
  }

  _accept(payload) {
    // A delayed response from another request must not rewind the visible day.
    const newerRevision = Number(payload.revision) > this.revision;
    const sameRevisionLaterClock = Number(payload.revision) === this.revision
      && (!this.serverTime || Date.parse(payload.serverTime) >= Date.parse(this.serverTime));
    if (newerRevision || sameRevisionLaterClock) {
      this.state = payload.state; this.week = payload.week; this.serverTime = payload.serverTime;
      this.revision = Number(payload.revision); this.onState?.(payload);
    }
    return payload;
  }

  async _request(body) {
    try {
      const response = await this.fetcher(this.endpoint, {
        method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      let payload;
      try { payload = await response.json(); } catch { throw new AcademyAPIError('invalid_response', 'The academy could not load saved progress. Please try again.', response.status); }
      if (!response.ok) throw new AcademyAPIError(payload.error?.code || 'request_failed', payload.error?.message || 'The academy request did not finish.', response.status, payload.error || {});
      return this._accept(payload);
    } catch (error) {
      const failure = error instanceof AcademyAPIError ? error
        : new AcademyAPIError('offline', 'Reconnect to save progress or reset the day. Your current activities are still available for practice.');
      if (body && failure.status === 409 && ['stale_journey', 'stale_day', 'stale_semester', 'stale_major', 'major_locked', 'traits_locked', 'already_graduated', 'progress_busy', 'loma_daily_limit'].includes(failure.code)) {
        // A different tab may have changed the day/semester. Refresh visible state
        // without replaying this mutation or replacing its original conflict.
        try { await this._request(); } catch { /* Preserve the original conflict. */ }
      }
      this.onError?.(failure); throw failure;
    }
  }

  _tokens() {
    if (!this.state?.initialized) throw new AcademyAPIError('not_initialized', 'Create your cadet before starting the course.', 409);
    return { expectedJourneyId: this.state.journeyId, expectedDay: this.state.day };
  }

  load() { return this._request(); }
  init(profile) { return this._request({ action: 'init', profile }); }
  complete(activityId, answers = {}, reviews = {}) {
    return this._request({ action: 'complete', ...this._tokens(), activityId, answers, reviews });
  }
  npcComplete(missionId, answers = {}) {
    return this._request({ action: 'npcComplete', ...this._tokens(), missionId, answers });
  }
  completeSafety(safetyId, answers = {}) {
    return this._request({ action: 'completeSafety', ...this._tokens(), safetyId, answers });
  }
  startLoma() {
    return this._request({ action: 'startLoma', ...this._tokens(), expectedMajor: this.state.profile.major });
  }
  completeLoma(gameId, answers = {}) {
    return this._request({ action: 'completeLoma', ...this._tokens(), gameId, answers });
  }
  introduceNPC(npcId) {
    return this._request({ action: 'introduceNPC', ...this._tokens(), npcId });
  }
  fitness(kind, proof = {}) { return this._request({ action: 'fitness', ...this._tokens(), kind, proof }); }
  rpgProfile(values = {}) {
    const fields = {};
    for (const key of ['heightCm', 'weightKg', 'traits']) if (Object.hasOwn(values, key)) fields[key] = values[key];
    return this._request({ action: 'rpgProfile', ...this._tokens(), ...fields });
  }
  rpgCare(kind, location) { return this._request({ action: 'rpgCare', ...this._tokens(), kind, location }); }
  profile(profile) { return this._request({ action: 'profile', ...this._tokens(), profile }); }
  advance() { return this._request({ action: 'advance', ...this._tokens(), expectedSemester: this.state.semester }); }
  newJourney(profile) {
    this._pendingSleep = null;
    return this._request({ action: 'newJourney', ...this._tokens(), profile, confirm: true });
  }

  async sleep() {
    const tokens = this._tokens();
    // Retry an uncertain network outcome with the exact same id and original day.
    if (!this._pendingSleep || this._pendingSleep.expectedJourneyId !== tokens.expectedJourneyId || this._pendingSleep.expectedDay !== tokens.expectedDay) {
      const requestId = globalThis.crypto?.randomUUID?.() || `sleep-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      this._pendingSleep = { action: 'sleep', ...tokens, requestId };
    }
    const request = this._pendingSleep;
    try {
      const response = await this._request(request);
      if (this._pendingSleep === request) this._pendingSleep = null;
      return response;
    } catch (error) {
      // Validation failures are definite. Network/503 failures retain the id.
      if (error.status && error.status < 500 && this._pendingSleep === request) this._pendingSleep = null;
      throw error;
    }
  }
}

export default AcademyAPI;
