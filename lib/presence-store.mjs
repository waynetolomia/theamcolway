import { AcademyError } from '../public/game/course-progress.js';
import { normalizeCharacter } from '../public/game/progress.js';
import { CLASS_ALPHABET, normalizeClassCode, validateLook } from '../public/game/presence-protocol.js';

export { normalizeClassCode } from '../public/game/presence-protocol.js';

const classError = () => new AcademyError('class_unavailable', 'This class code is closed or unavailable. Check the code with your teacher.', 404);
const iso = now => new Date(now).toISOString();

export async function requireOpenClassWorld(database, input) {
  const code = normalizeClassCode(input);
  if (!code) throw classError();
  const row = await database.prepare('SELECT code, created_at, closed_at FROM class_worlds WHERE code = ? AND closed_at IS NULL')
    .bind(code).first();
  if (!row) throw classError();
  return { code: row.code, createdAt: row.created_at, closedAt: null };
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  // 32 symbols divide 256 exactly, so this does not bias the generated codes.
  const code = Array.from(bytes, byte => CLASS_ALPHABET[byte & 31]).join('');
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/** Caller verifies the staff allowlist; no client-provided creator is accepted. */
export async function createClassWorld(database, userId, now, makeCode = randomCode) {
  const createdAt = iso(now);
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = normalizeClassCode(makeCode());
    if (!code) throw new AcademyError('class_unavailable', 'A class code could not be created. Please try again.', 503);
    const result = await database.prepare('INSERT OR IGNORE INTO class_worlds (code, created_by, created_at, closed_at) VALUES (?, ?, ?, NULL)')
      .bind(code, userId, createdAt).run();
    if (Number(result?.meta?.changes) === 1) return { code, createdAt, closedAt: null };
  }
  throw new AcademyError('class_unavailable', 'A class code could not be created. Please try again.', 503);
}

export async function listClassWorlds(database, userId) {
  const result = await database.batch([
    database.prepare('SELECT code, created_at, closed_at FROM class_worlds WHERE created_by = ? AND closed_at IS NULL ORDER BY created_at DESC, code LIMIT 50')
      .bind(userId),
  ]);
  return (result[0]?.results || []).map(row => ({ code: row.code, createdAt: row.created_at, closedAt: row.closed_at }));
}

/** Idempotent: repeating close keeps its first timestamp and can retry room cleanup. */
export async function closeClassWorld(database, input, now) {
  const code = normalizeClassCode(input);
  if (!code) throw classError();
  await database.prepare('UPDATE class_worlds SET closed_at = COALESCE(closed_at, ?) WHERE code = ?')
    .bind(iso(now), code).run();
  const row = await database.prepare('SELECT code, closed_at FROM class_worlds WHERE code = ?').bind(code).first();
  if (!row) throw classError();
  return { code: row.code, closedAt: row.closed_at };
}

function publicFirstName(name, userId) {
  const first = name.replace(/[\u0000-\u001f\u007f]/gu, '').trim().split(/\s+/u)[0];
  const subject = userId.split(':').at(-1);
  // A saved display name is user-entered. Do not turn an accidental email,
  // account identifier, URL or UUID entered there into a public name tag.
  if (!first || /[@:/\\]/u.test(first) || /^[a-f0-9]{8}-[a-f0-9-]{8,}$/iu.test(first) ||
      first.toLowerCase() === userId.toLowerCase() || first.toLowerCase() === subject.toLowerCase()) return 'Cadet';
  return Array.from(first).slice(0, 28).join('');
}

/** Presence is read-only against academy_accounts and never creates a journey. */
export async function loadPresenceProfile(database, userId) {
  const row = await database.prepare(`SELECT json_extract(document, '$.journey.profile') AS profile,
    json_extract(document, '$.journey.semester') AS semester,
    json_extract(document, '$.journey.initialized') AS initialized
    FROM academy_accounts WHERE user_id = ?`).bind(userId).first();
  if (!row || !row.initialized || !row.profile) {
    throw new AcademyError('cadet_required', 'Save your cadet before joining online play.', 409);
  }
  const profile = normalizeCharacter(JSON.parse(row.profile));
  const { gender, major, hairStyle, uniformBottom, outfit, body, accessory, skin, hairColor, accent } = profile;
  const look = validateLook({ gender, major, hairStyle, uniformBottom, outfit, body, accessory, skin, hairColor, accent });
  const semester = Number.isInteger(row.semester) ? Math.max(1, Math.min(8, row.semester)) : 1;
  return { name: publicFirstName(profile.name, userId), look, major, year: Math.ceil(semester / 2) };
}

/** Keys are resolved to verified account identities inside their current room. */
export async function recordPresenceReport(database, { reporterId, reportedId, room, now }, makeId = () => crypto.randomUUID()) {
  if (!reporterId || !reportedId || reporterId === reportedId) return false;
  await database.prepare('INSERT INTO presence_reports (id, reporter_id, reported_id, room, reported_at) VALUES (?, ?, ?, ?, ?)')
    .bind(makeId(), reporterId, reportedId, room, iso(now)).run();
  return true;
}
