import { spawn, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import type { ReportWorkerConfig } from './config.js';
import { isLocalPortListening } from './supervisor.js';

const execFileAsync = promisify(execFile);

export interface WorkerLaunchOptions {
  gedeminExe: string;
  /** Firebird connection string host/port:path */
  sn: string;
  user: string;
  password: string;
  host?: string;
  port?: number;
  /** How long to wait for /test after spawn. Default 90s. */
  readyTimeoutMs?: number;
}

export function buildWorkerSn(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.GEDEMIN_WORKER_SN?.trim();
  if (explicit) return explicit;
  const host = env.NODE_FB_HOST?.trim();
  const port = env.NODE_FB_PORT?.trim();
  const database = env.NODE_FB_DB?.trim();
  if (host && port && database) return `${host}/${port}:${database}`;
  return '';
}

export function workerListenHost(env: NodeJS.ProcessEnv = process.env): string {
  return env.GEDEMIN_WORKER_HOST?.trim() || '127.0.0.1';
}

export function workerListenPort(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number.parseInt(env.GEDEMIN_WORKER_PORT ?? '9080', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 9080;
}

/** Fail closed if worker is not bound to loopback (H03 / P5 workaround). */
export function assertWorkerLoopbackHost(
  host: string = workerListenHost()
): { ok: boolean; message: string } {
  const normalized = host.trim().toLowerCase();
  if (normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1') {
    return {
      ok: true,
      message: `worker host is loopback (${host})`,
    };
  }
  return {
    ok: false,
    message: `GEDEMIN_WORKER_HOST must be 127.0.0.1 (got "${host}") — do not expose Gedemin web on the LAN`,
  };
}

export async function stopGedeminWorkerProcess(pid: number): Promise<void> {
  if (!Number.isFinite(pid) || pid <= 0) return;
  if (process.platform !== 'win32') {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await execFileAsync(
      'taskkill',
      ['/PID', String(pid), '/T', '/F'],
      { windowsHide: true, timeout: 15_000 }
    );
  } catch {
    /* already gone */
  }
}

/**
 * Spawn gedemin.exe /Q /NS for the worker DB. Does not kill other Gedemin UI sessions.
 */
export async function startGedeminWorkerProcess(
  options: WorkerLaunchOptions
): Promise<{ pid: number }> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 9080;
  const bind = assertWorkerLoopbackHost(host);
  if (!bind.ok) {
    throw new Error(bind.message);
  }
  if (!existsSync(options.gedeminExe)) {
    throw new Error(`gedemin.exe not found: ${options.gedeminExe}`);
  }
  if (!options.sn) {
    throw new Error('Worker SN (Firebird connection string) is required');
  }

  if (await isLocalPortListening(host, port)) {
    throw new Error(
      `Worker port ${host}:${port} already responds — refuse to start a second process`
    );
  }

  const args = [
    '/SN',
    options.sn,
    '/USER',
    options.user,
    '/PASSWORD',
    options.password,
    '/Q',
    '/NS',
  ];

  const child = spawn(options.gedeminExe, args, {
    cwd: dirname(options.gedeminExe),
    windowsHide: false,
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
  const pid = child.pid;
  if (pid == null) {
    throw new Error('Failed to spawn gedemin.exe (no pid)');
  }

  const deadline = Date.now() + (options.readyTimeoutMs ?? 90_000);
  while (Date.now() < deadline) {
    if (await isLocalPortListening(host, port)) {
      return { pid };
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  await stopGedeminWorkerProcess(pid);
  throw new Error(`Worker web did not respond on ${host}:${port} within timeout`);
}

export function launchOptionsFromConfig(
  config: ReportWorkerConfig,
  env: NodeJS.ProcessEnv = process.env
): WorkerLaunchOptions {
  return {
    gedeminExe: config.gedeminExe,
    sn: buildWorkerSn(env),
    user: config.user,
    password: config.password,
    host: workerListenHost(env),
    port: workerListenPort(env),
  };
}
