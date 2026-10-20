import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

// Real SQLite, exact shipped migrations and the same SQL used by D1. All data
// lives in memory; this helper opens no network or production database.
export function sqliteD1() {
  const sqlite = new DatabaseSync(':memory:');
  const directory = new URL('../migrations/', import.meta.url);
  for (const file of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(file, directory), 'utf8'));
  }
  const execute = ({ sql, values }) => {
    const statement = sqlite.prepare(sql);
    if (/^\s*SELECT/i.test(sql)) return { success: true, results: statement.all(...values), meta: { changes: 0 } };
    return { success: true, results: [], meta: { changes: Number(statement.run(...values).changes) } };
  };
  const database = {
    prepare(sql) {
      return { bind(...values) {
        const bound = { sql, values };
        return { ...bound,
          async first() { return sqlite.prepare(sql).get(...values) ?? null; },
          async run() { return execute(bound); },
        };
      } };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const result = statements.map(execute);
        sqlite.exec('COMMIT');
        return result;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    withSession(constraint) {
      if (constraint !== 'first-primary') throw new Error('Expected authoritative D1 session');
      return database;
    },
    userIDs() { return sqlite.prepare('SELECT user_id FROM academy_accounts ORDER BY user_id').all().map(row => row.user_id); },
    close() { sqlite.close(); },
  };
  return database;
}
