/**
 * Run a single Gedemin worker under the 2.3 supervisor loop.
 * Usage: node packages/report-worker/scripts/supervise-worker.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadReportWorkerConfig } from '../src/config.ts';
import {
  assertWorkerLoopbackHost,
  buildWorkerSn,
  launchOptionsFromConfig,
  workerListenHost,
  workerListenPort,
} from '../src/lifecycle.ts';
import { WorkerSupervisor } from '../src/supervisor.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
for (const line of readFileSync(resolve(repoRoot, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}

const config = loadReportWorkerConfig();
if (!config) {
  console.error('GEDEMIN_WORKER_USER / GEDEMIN_WORKER_PASSWORD required');
  process.exit(1);
}

const host = workerListenHost();
const port = workerListenPort();
const bind = assertWorkerLoopbackHost(host);
if (!bind.ok) {
  console.error(bind.message);
  process.exit(1);
}

const sn = buildWorkerSn();
if (!sn) {
  console.error('GEDEMIN_WORKER_SN or NODE_FB_HOST/PORT/DB required');
  process.exit(1);
}

const supervisor = new WorkerSupervisor({
  host,
  port,
  launch: launchOptionsFromConfig(config),
  onEvent: (event) => {
    if (event.type === 'started') {
      console.log(`[supervisor] started pid=${event.pid}`);
    } else if (event.type === 'modal_seen') {
      console.warn(
        `[supervisor] blocking modal: ${event.windows.map((w) => w.title).join(' | ')}`
      );
    } else {
      console.log(`[supervisor] ${event.type}`);
    }
  },
});

console.log(`[supervisor] watching http://${host}:${port}/ (SN ${sn})`);
await supervisor.ensureRunning();
supervisor.startLoop();

const shutdown = () => {
  console.log('[supervisor] stopping loop (worker process left running)');
  supervisor.stopLoop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
