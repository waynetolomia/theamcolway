CREATE TABLE presence_reports (
  id TEXT PRIMARY KEY NOT NULL,
  reporter_id TEXT NOT NULL,
  reported_id TEXT NOT NULL,
  room TEXT NOT NULL,
  reported_at TEXT NOT NULL
);

CREATE INDEX presence_reports_reported_time ON presence_reports (reported_id, reported_at);
CREATE INDEX presence_reports_reporter_time ON presence_reports (reporter_id, reported_at);
