const { getDb } = require('./schema');

async function listDlqJobs() {
  const db = await getDb();
  return db.all(`SELECT * FROM dead_letter_queue ORDER BY updated_at DESC`);
}

async function retryDlqJob(id) {
  const db = await getDb();
  const now = new Date().toISOString();
  let job;
  try {
    await db.exec('BEGIN IMMEDIATE TRANSACTION');
    job = await db.get('SELECT * FROM dead_letter_queue WHERE id = ?', id);
    if (!job) { await db.exec('ROLLBACK'); return null; }
    await db.run(
      `INSERT INTO jobs (id, command, state, attempts, max_retries, created_at, updated_at, available_at, error)
       VALUES (?, ?, 'pending', 0, ?, ?, ?, ?, NULL)`,
      [job.id, job.command, job.max_retries, job.created_at, now, now]
    );
    await db.run('DELETE FROM dead_letter_queue WHERE id = ?', id);
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    console.error(`Error retrying job ${id}:`, err.message);
    throw new Error(`Failed to retry job: ${err.message}`);
  }
  return job.id;
}

module.exports = { listDlqJobs, retryDlqJob };


