/**
 * Supervise 1–4 Gedemin workers (2.4).
 * Requires separate worker homes with Bindings=127.0.0.1:port each,
 * or GEDEMIN_WORKER_URLS pointing at already-running instances (supervise health only).
 *
 * Env:
 *   GEDEMIN_WORKER_POOL_SIZE / GEDEMIN_WORKER_URLS / GEDEMIN_WORKER_BASE_PORT
 *   GEDEMIN_WORKER_HOMES=D:\\Soft\\gedemin-worker,D:\\Soft\\gedemin-worker-2
 *     (optional; exe = <home>\\gedemin.exe per slot when starting)
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadReportWorkerConfig,
  resolveWorkerUrls,
} from '../src/config.ts';
import {
  assertWorkerLoopbackHost,
  buildWorkerSn,
  startGedeminWorkerProcess,
  stopGedeminWorkerProcess,
  workerListenHost,
} from '../src/lifecycle.ts';
import { WorkerPool } from '../src/pool.ts';
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

const urls = resolveWorkerUrls(process.env, config.baseUrl);
const homes = (process.env.GEDEMIN_WORKER_HOMES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const supervisors = [];
const pool = new WorkerPool({
  urls,
  token: config.token,
  requestTimeoutMs: config.timeoutMs,
  queueTimeoutMs: config.queueTimeoutMs,
  onHung: async (slot) => {
    console.warn(`[pool] hung slot ${slot.id} ${slot.baseUrl} — restart`);
    const sup = supervisors[slot.id];
    if (sup) await sup.restart(slot.pid != null ? [slot.pid] : []);
  },
});

for (let i = 0; i < urls.length; i++) {
  const baseUrl = urls[i];
  const port = Number.parseInt(new URL(baseUrl).port || '80', 10);
  const home = homes[i];
  const exe = home
    ? join(home, 'gedemin.exe')
    : config.gedeminExe;

  if (home && !existsSync(exe)) {
    console.error(`gedemin.exe not found for slot ${i}: ${exe}`);
    process.exit(1);
  }

  const supervisor = new WorkerSupervisor({
    host,
    port,
    launch: {
      gedeminExe: exe,
      sn,
      user: config.user,
      password: config.password,
      host,
      port,
    },
    onEvent: (event) => {
      if (event.type === 'started') {
        pool.setSlotPid(i, event.pid);
        console.log(`[pool:${i}] started pid=${event.pid} :${port}`);
      } else {
        console.log(`[pool:${i}] ${event.type}`);
      }
    },
  });
  supervisors.push(supervisor);

  console.log(`[pool:${i}] ensure ${baseUrl}`);
  try {
    await supervisor.ensureRunning();
  } catch (error) {
    console.warn(
      `[pool:${i}] ensureRunning: ${error instanceof Error ? error.message : error}`
    );
  }
  supervisor.startLoop();
}

console.log(
  `[pool] supervising ${urls.length} worker(s): ${urls.join(', ')}`
);

const shutdown = () => {
  console.log('[pool] stopping supervisor loops (workers left running)');
  for (const s of supervisors) s.stopLoop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
