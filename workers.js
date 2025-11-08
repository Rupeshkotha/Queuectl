const db = require('./src/db');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
let isShuttingDown = false;
let currentJobId = null;
let currentChild = null;
const RUN_DIR = path.join(__dirname, '.queue_run');
const STOP_FILE = path.join(RUN_DIR, `worker.${process.pid}.stop`);

const shutdown = () => {
    console.log(`[Worker ${process.pid}] Shutdown signal received. Finishing current job...`);
    isShuttingDown = true;
}
process.on('SIGINT', shutdown); 
process.on('SIGTERM', shutdown);
process.on('SIGBREAK', shutdown);

function runCommand(command) {
  let shell, args;
  if (process.platform === 'win32') {
    shell = 'cmd.exe';
    args = ['/C', command]; 
  } else {
    shell = '/bin/sh';
    args = ['-c', command]; 
  }

  const child = spawn(shell, args, { 
    stdio: 'pipe',
    windowsHide: true
  });
  currentChild = child;

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => stdout += data.toString());
    child.stderr.on('data', (data) => stderr += data.toString());

    child.on('close', (code) => {
      currentChild = null;
      if (code === 0) {
        resolve(stdout);
      } else {
        const err = new Error(`Command failed: ${stderr || 'Exited with code ' + code}`);
        err.code = typeof code === 'number' ? code : null;
        reject(err);
      }
    });

    child.on('error', (err) => {
      currentChild = null;
      reject(new Error(`Spawn error: ${err.message}`));
    });
  });
}

async function processJob(job) {
  console.log(`[Worker ${process.pid}] Processing job ${job.id}: ${job.command}`);
  currentJobId = job.id;
  
  try {
    const output = await runCommand(job.command);
    await db.completeJobs(job.id, 0);
    console.log(`[Worker ${process.pid}] Job ${job.id} completed. Output: ${output ? output.trim() : 'N/A'}`);

  } catch (error) {
    console.error(`[Worker ${process.pid}] Job ${job.id} failed. Error: ${error.message}`);
    const exitCode = typeof error.code === 'number' ? error.code : null;
    await db.failJob(job.id, error.message, exitCode);
  }
  currentJobId = null;
}

async function startWorker() {
  console.log(`[Worker ${process.pid}] Starting...`);
  while (!isShuttingDown) {
    try {
      if (fs.existsSync(STOP_FILE)) {
        console.log(`[Worker ${process.pid}] Stop file detected. Initiating graceful shutdown.`);
        isShuttingDown = true;
      }
    } catch (_) {}
    let job;
    try {
      job = await db.getNextJobs();

      if (!job) {
        if (isShuttingDown) break;
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      if (isShuttingDown) {
        console.log(`[Worker ${process.pid}] Shutdown requested after fetching job ${job.id}. Finishing this job, then exiting.`);
        await processJob(job);
        break;
      }

      await processJob(job);

    } catch (err) {
      console.error(`[Worker ${process.pid}] Unhandled error in main loop:`, err);
      if (isShuttingDown) break;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
console.log(`[Worker ${process.pid}] Main loop exited, performing cleanup...`);
  try {
    const pdb = await db.getDb();
    await pdb.close();
    console.log(`[Worker ${process.pid}] Database connection closed.`);
  } catch (err) {
    console.error(`[Worker ${process.pid}] Error closing DB:`, err && err.message ? err.message : err);
  }
  console.log(`[Worker ${process.pid}] Exiting.`);
  process.exit(0);
}

startWorker().catch(err => {
  console.error(`[Worker ${process.pid}] Unhandled fatal error:`, err && err.message ? err.message : err);
  process.exit(1);
});