# QueueCTL (JSON Store) – No Native Modules

A lightweight background job queue for Node.js using a JSON store.  
 Works out-of-the-box on **Windows, macOS, and Linux** — no native dependencies (no `better-sqlite3`, no `sqlite3`).

---

##  Install
```bash
npm install
```

---

##  Configuration
QueueCTL stores configuration in a local JSON file (`store.json`) and supports the following settings:

| Key | Description | Default |
|-----|--------------|----------|
| `maxRetries` | Number of retry attempts per failed job | `3` |
| `backoffBase` | Base for exponential backoff (seconds) | `2` |
| `defaultTimeoutMs` | Default timeout for jobs in milliseconds | `30000` |

You can view or modify config via CLI:
```bash
# Show current config
npx queuectl config

# Set config key
npx queuectl config set maxRetries 5
```

---

##  Usage Examples
```bash
# Enqueue a job
npx queuectl enqueue '{"command":"echo hello"}'

# Start workers (Ctrl+C to stop)
npx queuectl worker start --count 2

# Show queue status
npx queuectl status

# List completed jobs
npx queuectl list --state completed

# Show DLQ (Dead Letter Queue)
npx queuectl dlq list
```

---
- Jobs and metadata persist in `store.json` at the project root.
- Uses `proper-lockfile` for safe concurrent access between processes.
- `worker stop` is a no-op here; simply stop with **Ctrl+C** in the worker terminal.
- Features include:
  - Retry with exponential backoff  
  - DLQ (Dead Letter Queue)  
  - Job priority  
  - `run_at` scheduling  
  - Per-job timeout support

---

##  Commands Overview
| Command | Description |
|----------|-------------|
| `enqueue <job-json>` | Add a new job to the queue |
| `worker [options] [action]` | Manage worker processes |
| `status` | Show summary of job states and active workers |
| `list [options]` | List jobs filtered by state |
| `dlq [action] [jobId]` | DLQ operations (list, retry, etc.) |
| `config [action] [key] [value]` | Manage queue configuration |
| `show <id>` | Display details of a single job |
| `selftest` | Run a mini end-to-end test |
| `help [command]` | Display command help |

---

##  Video Demo
[ Watch Setup & Usage Guide on YouTube](https://youtu.be/a2-Vxl4mm8o)

---

##  Author
**Vamsi Pandillapalli**  
Built with  using Node.js
