
import os from 'os';
import { spawn } from 'child_process';
import { withStore, nowSec } from './store.js';
import { listConfig, getConfig } from './config.js';

const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

function calcBackoff(base, attempts) {
  const d = Math.pow(base, attempts);
  return Math.min(d, 100);
}

async function claimNextJob(workerId) {
  return withStore(db => {
    const now = nowSec();
    const candidates = db.jobs
      .filter(j => j.state === 'pending' && j.run_at <= now)
      .sort((a,b)=> (b.priority - a.priority) || (a.run_at - b.run_at) || (a.created_at - b.created_at));
    const job = candidates[0];
    if (!job) return null;
    job.state = 'processing';
    job.claimed_by = workerId;
    job.claimed_at = now;
    job.updated_at = now;
    return job;
  });
}

async function logLine(db, jobId, level, message) {
  db.logs.push({ job_id: jobId, level, message, ts: nowSec() });
}

async function executeJob(job) {
  const timeoutMs = job.timeout_ms ?? Number(await getConfig('defaultTimeoutMs') || 30000);
  await withStore(db => {
    const j = db.jobs.find(x => x.id === job.id);
    j.started_at = nowSec();
    j.updated_at = nowSec();
  });

  return new Promise(async (resolve) => {
    const child = spawn(job.command, { shell: true, stdio: ['ignore','pipe','pipe'] });
    let killedByTimeout = false;
    const timer = setTimeout(() => { killedByTimeout = true; child.kill('SIGKILL'); }, timeoutMs);

    let out = '', err = '';
    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());

    child.on('close', async (code) => {
      clearTimeout(timer);
      const ok = code === 0 && !killedByTimeout;
      await withStore(db => {
        const j = db.jobs.find(x => x.id === job.id);
        const finished = nowSec();
        if (ok) {
          j.state = 'completed';
          j.last_error = null;
          j.finished_at = finished;
        } else {
          j.attempts += 1;
          const base = Number(db.config.backoffBase || '2');
          const delay = calcBackoff(base, j.attempts);
          j.run_at = nowSec() + delay;
          const errMsg = killedByTimeout ? `timeout after ${timeoutMs}ms` : (err || `exit code ${code}`);
          j.last_error = errMsg;
          if (j.attempts >= j.max_retries) {
            j.state = 'dead';
            j.finished_at = finished;
          } else {
            j.state = 'pending';
          }
        }
        j.updated_at = nowSec();
      });
      resolve();
    });
  });
}

export async function runWorkers({ count = 1, pollInterval = 500 }) {
  const workerId = `${os.hostname()}-${process.pid}`;
  let running = true;
  process.on('SIGINT', ()=> { running = false; });

  const loops = Array.from({ length: count }, async () => {
    while (running) {
      const job = await claimNextJob(workerId);
      if (!job) { await sleep(pollInterval); continue; }
      await executeJob(job);
    }
  });
  await Promise.all(loops);
}

export function stopWorkers() {
  // For JSON store version, workers only stop with Ctrl+C (SIGINT) in their process.
  // Kept for CLI compatibility; no-op.
  return 0;
}
