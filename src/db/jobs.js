const { getDb } = require('./schema');
const { getConfigValue } = require('./config');

async function getJobCounts() {
  const db = await getDb();
  const [pendingCount, failedRetryable, processingCount, completedCount, deadCount] = await Promise.all([
    db.get("SELECT COUNT(*) as count FROM jobs WHERE state = 'pending' AND attempts = 0"),
    db.get("SELECT COUNT(*) as count FROM jobs WHERE state = 'pending' AND attempts > 0"),
    db.get("SELECT COUNT(*) as count FROM jobs WHERE state = 'processing'"),
    db.get("SELECT COUNT(*) as count FROM jobs WHERE state = 'completed'"),
    db.get("SELECT COUNT(*) as count FROM dead_letter_queue"),
  ]);
  return {
    pending: pendingCount.count,
    failed: failedRetryable.count,
    processing: processingCount.count,
    completed: completedCount.count,
    dead: deadCount.count,
    active_workers: 0,
  };
}

async function addJob(id, command, { maxRetries = null, availableAt = null } = {}) {
  const db = await getDb();
  const now = new Date().toISOString();
  let finalMaxRetries = maxRetries;
  if (finalMaxRetries === null) {
    const configRetries = await getConfigValue('max_retries', '3');
    finalMaxRetries = parseInt(configRetries, 10);
  }
  const newJob = {
    id,
    command,
    state: 'pending',
    attempts: 0,
    max_retries: finalMaxRetries,
    created_at: now,
    updated_at: now,
    available_at: availableAt || now,
  };
  await db.run(
    `INSERT INTO jobs (id, command, state, attempts, max_retries, created_at, updated_at, available_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [newJob.id, newJob.command, newJob.state, newJob.attempts, newJob.max_retries, newJob.created_at, newJob.updated_at, newJob.available_at]
  );
  return newJob.id;
}

async function getNextJobs() {
  const db = await getDb();
  const now = new Date().toISOString();
  let jobId;
  try {
    await db.exec('BEGIN IMMEDIATE TRANSACTION;');
    const job = await db.get(
      `SELECT id FROM jobs 
       WHERE state = 'pending' AND available_at <= ?
       ORDER BY created_at ASC
       LIMIT 1`,
      now
    );
    if (!job) {
      await db.exec('COMMIT');
      return null;
    }
    await db.run(
      `UPDATE jobs 
       SET state = 'processing', attempts = attempts + 1, updated_at = ? 
       WHERE id = ?`,
      now,
      job.id
    );
    await db.exec('COMMIT');
    jobId = job.id;
  } catch (err) {
    await db.exec('ROLLBACK;');
    console.error('Error fetching next job:', err);
    return null;
  }
  if (jobId) {
    return db.get('SELECT * FROM jobs WHERE id = ?', jobId);
  }
  return null;
}

async function completeJobs(id, exitCode = 0) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.run(
    `UPDATE jobs SET state = 'completed', updated_at = ?, exit_code = ? WHERE id = ?`,
    now,
    exitCode,
    id
  );
  console.log(`Job ${id} completed.`);
}

async function failJob(id, errorMessage = 'Job failed', exitCode = null) {
  const db = await getDb();
  const now = new Date().toISOString();
  const job = await db.get('SELECT * FROM jobs WHERE id = ?', id);
  if (!job) {
    console.error(`Job ${id} not found when trying to fail it.`);
    return;
  }
  const newAttempt = job.attempts + 1;
  if (newAttempt <= job.max_retries) {
    const backoffBase = await getConfigValue('backoff_base', '2');
    const backoffBaseNum = parseInt(backoffBase, 10);
    const exponentialBackoffSeconds = Math.pow(backoffBaseNum, job.attempts);
    const nextAvailableAt = new Date(Date.now() + exponentialBackoffSeconds * 1000).toISOString();
    console.log(`Job ${id} failed, will retry at ${nextAvailableAt}. Attempt ${newAttempt}/${job.max_retries}. Error: ${errorMessage}`);
    await db.run(
      `UPDATE jobs 
       SET state = 'pending', 
           attempts = ?, 
           updated_at = ?,
           available_at = ?,
           error = ?,
           exit_code = ?
       WHERE id = ?`,
      [newAttempt, now, nextAvailableAt, errorMessage, exitCode, id]
    );
  } else {
    console.log(`Job ${id} has permanently failed. Moving to Dead Letter Queue.`);
    try {
      await db.exec('BEGIN IMMEDIATE TRANSACTION');
      await db.run(
        `INSERT INTO dead_letter_queue (id, command, state, attempts, max_retries, created_at, updated_at, available_at, error, exit_code)
         VALUES (?, ?, 'dead', ?, ?, ?, ?, ?, ?, ?)`,
        [job.id, job.command, newAttempt, job.max_retries, job.created_at, now, job.available_at, errorMessage, exitCode]
      );
      await db.run('DELETE FROM jobs WHERE id = ?', id);
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      console.error(`Failed to move job ${id} to DLQ:`, err);
    }
  }
}

async function listJobs(state) {
  const db = await getDb();
  const validStates = ['pending', 'failed', 'processing', 'completed'];
  if (!validStates.includes(state)) {
    throw new Error(`Invalid state: "${state}". Must be one of: ${validStates.join(', ')}`);
  }
  if (state === 'failed') {
    return db.all(`SELECT * FROM jobs WHERE state = 'pending' AND attempts > 0 ORDER BY created_at DESC`);
  }
  if (state === 'pending') {
    return db.all(`SELECT * FROM jobs WHERE state = 'pending' AND attempts = 0 ORDER BY created_at DESC`);
  }
  return db.all(`SELECT * FROM jobs WHERE state = ? ORDER BY created_at DESC`, state);
}

module.exports = { getJobCounts, addJob, getNextJobs, completeJobs, failJob, listJobs };


