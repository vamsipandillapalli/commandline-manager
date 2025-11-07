
import fs from 'fs';
import path from 'path';
import lockfile from 'proper-lockfile';

const DB_PATH = process.env.QUEUECTL_STORE || path.join(process.cwd(), 'store.json');

function ensureFile() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({
      jobs: [],
      logs: [],
      workers: [],
      config: {
        maxRetries: "3",
        backoffBase: "2",
        defaultTimeoutMs: "30000"
      }
    }, null, 2));
  }
}

export async function withStore(fn) {
  ensureFile();
  const release = await lockfile.lock(DB_PATH, { retries: { retries: 50, factor: 1.2, minTimeout: 10, maxTimeout: 100 } });
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const db = JSON.parse(raw);
    const result = await fn(db);
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    return result;
  } finally {
    await release();
  }
}

export function nowSec() { return Math.floor(Date.now() / 1000); }
