#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import { enqueue, listJobs, listDLQ, retryDLQ, jobCounts, getJob } from '../src/jobs.js';
import { runWorkers, stopWorkers } from '../src/worker.js';
import { status as statusFn } from '../src/status.js';
import { getConfig, setConfig, listConfig } from '../src/config.js';

const program = new Command();
program
  .name('queuectl')
  .description('CLI background job queue (JSON store, no native deps)')
  .version('1.0.0');

program
  .command('enqueue')
  .argument('<job-json>', 'Job JSON string or @file.json')
  .description('Add a new job to the queue')
  .action(async (arg) => {
    try {
      let payload;
      if (arg.startsWith('@')) {
        const p = arg.slice(1);
        payload = JSON.parse(fs.readFileSync(p, 'utf-8'));
      } else {
        payload = JSON.parse(arg);
      }
      if (!payload.command) {
        console.error(chalk.red('Missing job.command'));
        process.exit(1);
      }
      const id = await enqueue(payload);
      console.log(chalk.green('Enqueued:'), id);
    } catch (e) {
      console.error(chalk.red('Failed to enqueue:'), e.message);
      process.exit(1);
    }
  });

program
  .command('worker')
  .description('Manage workers')
  .option('--count <n>', 'Number of workers', (v)=>parseInt(v,10), 1)
  .option('--poll <ms>', 'Poll interval ms', (v)=>parseInt(v,10), 500)
  .argument('[action]', 'start|stop', 'start')
  .action(async (action, opts) => {
    if (action === 'start') {
      console.log(chalk.blue(`Starting ${opts.count} worker(s)... Ctrl+C to stop`));
      await runWorkers({ count: opts.count, pollInterval: opts.poll });
      console.log(chalk.yellow('Workers stopped.'));
    } else if (action === 'stop') {
      const n = stopWorkers();
      console.log(chalk.yellow(`Stop signal sent (no-op in JSON store).`));
    } else {
      console.log('Unknown action. Use start|stop.');
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show summary of job states & active workers')
  .action(async () => {
    const s = await statusFn();
    console.log(chalk.cyan('Job counts:'), s.counts);
  });

program
  .command('list')
  .description('List jobs by state')
  .option('--state <state>', 'Filter by state')
  .action(async (opts) => {
    const rows = await listJobs({ state: opts.state });
    if (!rows.length) return console.log(chalk.yellow('No jobs.'));
    for (const r of rows) {
      console.log(`${r.id} [${r.state}] attempts=${r.attempts}/${r.max_retries} priority=${r.priority} run_at=${r.run_at} cmd=${r.command}`);
    }
  });

program
  .command('dlq')
  .description('DLQ operations')
  .argument('[action]', 'list|retry', 'list')
  .argument('[jobId]', 'job id for retry')
  .action(async (action, jobId) => {
    if (action === 'list') {
      const rows = await listDLQ();
      if (!rows.length) return console.log(chalk.yellow('DLQ is empty.'));
      for (const r of rows) {
        console.log(`${r.id} error=${r.last_error} attempts=${r.attempts} cmd=${r.command}`);
      }
    } else if (action === 'retry') {
      if (!jobId) {
        console.error('Provide a job id: queuectl dlq retry <id>');
        process.exit(1);
      }
      try {
        await retryDLQ(jobId);
        console.log(chalk.green('Re-enqueued from DLQ:'), jobId);
      } catch (e) {
        console.error(chalk.red('Retry failed:'), e.message);
        process.exit(1);
      }
    } else {
      console.log('Unknown action. Use list|retry.');
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Manage configuration')
  .argument('[action]', 'get|set|list', 'list')
  .argument('[key]', 'config key')
  .argument('[value]', 'config value')
  .action(async (action, key, value) => {
    if (action === 'list') {
      const rows = await listConfig();
      for (const r of rows) console.log(`${r.key}=${r.value}`);
    } else if (action === 'get') {
      if (!key) return console.error('Provide key');
      console.log(await getConfig(key));
    } else if (action === 'set') {
      if (!key) return console.error('Provide key'); 
      if (typeof value === 'undefined') return console.error('Provide value');
      await setConfig(key, value);
      console.log(chalk.green('Set'), key, '=', value);
    } else {
      console.log('Unknown action. Use get|set|list.');
      process.exit(1);
    }
  });

program
  .command('show')
  .argument('<id>', 'Job id')
  .description('Show a single job')
  .action(async (id) => {
    const r = await getJob(id);
    if (!r) return console.log('Not found');
    console.log(JSON.stringify(r, null, 2));
  });

program
  .command('selftest')
  .description('Run a tiny e2e test')
  .action(async () => {
    console.log('Enqueue 3 jobs (2 ok, 1 fail)...');
    const ok1 = { command: "node -e \"process.exit(0)\"" };
    const ok2 = { command: "echo Hello", priority: 1 };
    const bad = { command: "exit 2", max_retries: 2 };
    const id1 = await enqueue(ok1);
    const id2 = await enqueue(ok2);
    const id3 = await enqueue(bad);
    console.log('IDs:', id1, id2, id3);
    console.log('Starting 2 workers for 6 seconds... Press Ctrl+C to stop earlier.');
    setTimeout(()=>process.exit(0), 6000);
    await runWorkers({ count: 2, pollInterval: 200 });
  });

program.parseAsync(process.argv);
