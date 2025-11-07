
import { withStore, nowSec } from './store.js';
import { nanoid } from 'nanoid';

export async function enqueue(jobInput) {
  const id = jobInput.id || nanoid();
  const job = {
    id,
    command: jobInput.command,
    state: 'pending',
    attempts: 0,
    max_retries: jobInput.max_retries ?? 3,
    priority: jobInput.priority ?? 0,
    run_at: jobInput.run_at ? (typeof jobInput.run_at === 'number' ? jobInput.run_at : Math.floor(new Date(jobInput.run_at).getTime()/1000)) : nowSec(),
    timeout_ms: jobInput.timeout_ms ?? null,
    created_at: nowSec(),
    updated_at: nowSec(),
    last_error: null,
    claimed_by: null,
    claimed_at: null,
    started_at: null,
    finished_at: null
  };
  await withStore(db => { db.jobs.push(job); });
  return id;
}

export async function listJobs({ state } = {}) {
  return withStore(db => {
    const rows = state ? db.jobs.filter(j => j.state === state) : db.jobs;
    return rows.slice().sort((a,b)=>b.created_at - a.created_at);
  });
}

export async function jobCounts() {
  return withStore(db => {
    const m = { pending:0, processing:0, completed:0, failed:0, dead:0 };
    for (const j of db.jobs) m[j.state] = (m[j.state]||0)+1;
    return m;
  });
}

export async function getJob(id) {
  return withStore(db => db.jobs.find(j => j.id === id) || null);
}

export async function listDLQ() {
  return withStore(db => db.jobs.filter(j => j.state === 'dead').sort((a,b)=>b.updated_at - a.updated_at));
}

export async function retryDLQ(id) {
  return withStore(db => {
    const j = db.jobs.find(x => x.id === id);
    if (!j) throw new Error('Job not found');
    if (j.state !== 'dead') throw new Error('Job is not in DLQ');
    j.state = 'pending';
    j.attempts = 0;
    j.last_error = null;
    j.claimed_by = null;
    j.claimed_at = null;
    j.started_at = null;
    j.finished_at = null;
    j.run_at = nowSec();
    j.updated_at = nowSec();
  });
}
