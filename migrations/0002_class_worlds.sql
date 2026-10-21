CREATE TABLE class_worlds (
  code TEXT PRIMARY KEY NOT NULL CHECK(length(code) = 7),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE INDEX class_worlds_creator_open ON class_worlds (created_by, closed_at, created_at);
