import { AcademyError, applyAction, createAccount, publicState, getWeekStatus } from '../public/game/course-progress.js';

const TABLE = 'academy_accounts';
const SUBMISSIONS = 'academy_submissions';

function progressDocument(document) {
  const results = Object.fromEntries(Object.entries(document.journey.results).map(([id, result]) => {
    const { answers, reviews, ...metadata } = result;
    return [id, metadata];
  }));
  return { ...document, journey: { ...document.journey, results } };
}

/**
 * Single-record optimistic transactions work across requests and Worker instances.
 * A failed or contended SQL update never consumes a reset separately from the day.
 */
export async function readAccount(database, userId, now, makeId = () => crypto.randomUUID()) {
  const readSnapshot = () => database.batch([
    database.prepare(`SELECT revision, document FROM ${TABLE} WHERE user_id = ?`).bind(userId),
    database.prepare(`SELECT activity_id, document FROM ${SUBMISSIONS} WHERE user_id = ? AND journey_id = (SELECT json_extract(document, '$.journey.journeyId') FROM ${TABLE} WHERE user_id = ?)`).bind(userId, userId),
  ]);
  let snapshot = await readSnapshot();
  let row = snapshot[0]?.results?.[0];
  if (!row) {
    const document = createAccount(now, makeId());
    await database.prepare(`INSERT OR IGNORE INTO ${TABLE} (user_id, revision, document, updated_at) VALUES (?, 0, ?, ?)`)
      .bind(userId, JSON.stringify(document), new Date(now).toISOString()).run();
    snapshot = await readSnapshot();
    row = snapshot[0]?.results?.[0];
  }
  if (!row) throw new AcademyError('storage_unavailable', 'Your progress could not be loaded. Please try again.', 503);
  const document = JSON.parse(row.document);
  for (const submission of snapshot[1]?.results || []) {
    if (document.journey.results[submission.activity_id]) {
      Object.assign(document.journey.results[submission.activity_id], JSON.parse(submission.document));
    }
  }
  return { revision: Number(row.revision), document };
}

export function responseFor(row, now, activities, extra = {}) {
  return {
    state: publicState(row.document, now, activities),
    week: getWeekStatus(row.document, now),
    serverTime: new Date(now).toISOString(),
    revision: row.revision,
    ...extra,
  };
}

export async function mutateAccount(database, userId, payload, now, activities, makeId = () => crypto.randomUUID()) {
  // Allocate once so a CAS retry cannot create two different candidate journeys.
  const nextJourneyId = payload.action === 'newJourney' ? makeId() : undefined;
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await readAccount(database, userId, now, makeId);
    const next = applyAction(row.document, payload, now, activities, { journeyId: nextJourneyId });
    if (!next.changed) return responseFor(row, now, activities, { feedback: next.feedback, reward: next.reward || null, duplicate: next.duplicate });
    const encoded = JSON.stringify(progressDocument(next.account));
    if (encoded.length > 1_500_000) throw new AcademyError('progress_full', 'Your saved responses are too large. Shorten the current response before submitting.', 413);
    const writeProgress = database.prepare(`UPDATE ${TABLE} SET document = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?`)
      .bind(encoded, new Date(now).toISOString(), userId, row.revision);
    let result;
    if (payload.action === 'complete') {
      const saved = next.account.journey.results[payload.activityId];
      const submission = JSON.stringify({ answers: saved.answers, reviews: saved.reviews });
      const writeSubmission = database.prepare(`INSERT INTO ${SUBMISSIONS} (user_id, journey_id, activity_id, document, updated_at) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM ${TABLE} WHERE user_id = ? AND revision = ?) ON CONFLICT(user_id, journey_id, activity_id) DO UPDATE SET document = excluded.document, updated_at = excluded.updated_at`)
        .bind(userId, next.account.journey.journeyId, payload.activityId, submission, new Date(now).toISOString(), userId, row.revision);
      const batch = await database.batch([writeSubmission, writeProgress]);
      result = batch[1];
    } else {
      result = await writeProgress.run();
    }
    if (Number(result?.meta?.changes) === 1) {
      return responseFor({ document: next.account, revision: row.revision + 1 }, now, activities, {
        feedback: next.feedback, reward: next.reward || null, duplicate: next.duplicate,
      });
    }
    // Another tab committed first. Reload and reapply all rules against that state.
  }
  throw new AcademyError('progress_busy', 'Your progress is being updated in another window. Refresh and try again.', 409);
}
