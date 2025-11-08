const sqlite = require('sqlite3').verbose();
const { open } = require('sqlite');
const DB = './jobs.db';
const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    command TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    available_at TEXT NOT NULL,
    error TEXT,
    exit_code INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_state_available_at ON jobs (state, available_at);

  CREATE TABLE IF NOT EXISTS dead_letter_queue (
    id TEXT PRIMARY KEY,
    command TEXT NOT NULL,
    state TEXT NOT NULL,
    attempts INTEGER NOT NULL,
    max_retries INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    available_at TEXT NOT NULL,
    error TEXT,
    exit_code INTEGER
  );

  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

let dbPromise = null;
async function initDatabase() {
  const db = await open({ filename: DB, driver: sqlite.Database });
  await db.exec(CREATE_TABLE);
  try { await db.run('ALTER TABLE jobs ADD COLUMN exit_code INTEGER'); } catch (_) {}
  try { await db.run('ALTER TABLE dead_letter_queue ADD COLUMN exit_code INTEGER'); } catch (_) {}
  await db.run("INSERT OR IGNORE INTO config (key, value) VALUES ('max_retries', '3')");
  await db.run("INSERT OR IGNORE INTO config (key, value) VALUES ('backoff_base', '2')");
  return db;
}

async function getDb() {
  if (!dbPromise) dbPromise = initDatabase();
  return dbPromise;
}

module.exports = { getDb };


