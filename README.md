
# QueueCTL (JSON Store) – No Native Modules

This variant avoids native addons (no `better-sqlite3`, no `sqlite3`) and works out-of-the-box on Windows, macOS, and Linux.

## Install
```bash
npm install
```

## Use
```bash
npx queuectl enqueue '{"command":"echo hello"}'
npx queuectl worker start --count 2
npx queuectl status
npx queuectl list --state completed
npx queuectl dlq list
```

## Notes
- Persists to `store.json` in the project root.
- File-locking via `proper-lockfile` protects against concurrent access across processes.
- `worker stop` is a no-op here; stop with Ctrl+C in the worker terminal.
- Supports: retries with exponential backoff, DLQ, priority, run_at, per-job timeout.
- after staring workernode enter ctrl_c
```
## video link 
https://youtu.be/a2-Vxl4mm8o
