
import { withStore } from './store.js';

export async function status() {
  return withStore(db => {
    const counts = { pending:0, processing:0, completed:0, failed:0, dead:0 };
    for (const j of db.jobs) counts[j.state] = (counts[j.state]||0)+1;
    return { counts, workers: [] };
  });
}
