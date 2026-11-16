/**
 * Worker supervisor (2.3): dismiss blocking modals, watch port, restart one worker.
 * No platform patches (D18). Pool of workers is 2.4.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { markWorkerBlocked } from './block-state.js';
import {
  startGedeminWorkerProcess,
  stopGedeminWorkerProcess,
  type WorkerLaunchOptions,
} from './lifecycle.js';

const execFileAsync = promisify(execFile);

export interface WorkerWindowInfo {
  pid: number;
  title: string;
}

/** Known Gedemin modal titles that block the single-threaded web server. */
const BLOCKING_TITLE_RE =
  /Внимание|Attention|Error|Ошибка|Security Warning|Open File/i;

export function isBlockingWindowTitle(title: string): boolean {
  return BLOCKING_TITLE_RE.test(title.trim());
}

/**
 * List gedemin main-window titles via PowerShell (Windows).
 * Returns empty array on non-Windows or if PowerShell fails.
 */
export async function listGedeminWindows(): Promise<WorkerWindowInfo[]> {
  if (process.platform !== 'win32') return [];
  const script = [
    "Get-Process gedemin -ErrorAction SilentlyContinue |",
    "  Where-Object { $_.MainWindowTitle } |",
    "  ForEach-Object { '{0}|{1}' -f $_.Id, $_.MainWindowTitle }",
  ].join(' ');
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-Command', script],
      { windowsHide: true, timeout: 10_000 }
    );
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const pipe = line.indexOf('|');
        return {
          pid: Number(line.slice(0, pipe)),
          title: line.slice(pipe + 1),
        };
      })
      .filter((w) => Number.isFinite(w.pid));
  } catch {
    return [];
  }
}

export async function findBlockingGedeminWindows(): Promise<WorkerWindowInfo[]> {
  const windows = await listGedeminWindows();
  return windows.filter((w) => isBlockingWindowTitle(w.title));
}

export async function isLocalPortListening(
  host: string,
  port: number
): Promise<boolean> {
  try {
    const res = await fetch(`http://${host}:${port}/test`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok || res.status > 0;
  } catch {
    return false;
  }
}

/**
 * Best-effort: focus a blocking dialog and press Enter (OK).
 * Does not guarantee the dialog is gone; caller should re-check titles.
 */
export async function tryDismissBlockingDialog(
  info: WorkerWindowInfo
): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  if (!isBlockingWindowTitle(info.title)) return false;
  const script = [
    `$w = New-Object -ComObject WScript.Shell`,
    `if ($w.AppActivate(${info.pid})) { Start-Sleep -Milliseconds 200; $w.SendKeys('{ENTER}'); $true } else { $false }`,
  ].join('; ');
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-Command', script],
      { windowsHide: true, timeout: 10_000 }
    );
    return /True/i.test(stdout);
  } catch {
    return false;
  }
}

export type SupervisorEvent =
  | { type: 'modal_seen'; windows: WorkerWindowInfo[] }
  | { type: 'modal_dismissed' }
  | { type: 'modal_restart'; windows: WorkerWindowInfo[] }
  | { type: 'port_down' }
  | { type: 'port_restart' }
  | { type: 'port_up' }
  | { type: 'started'; pid: number };

export interface WorkerSupervisorOptions {
  host: string;
  port: number;
  launch: WorkerLaunchOptions;
  /** Poll interval. Default 3s. */
  pollIntervalMs?: number;
  /** Restart if port stays down this long. Default 10s. */
  portDownRestartMs?: number;
  /** Dismiss attempts before kill+restart. Default 2. */
  modalDismissAttempts?: number;
  onEvent?: (event: SupervisorEvent) => void;
  /** Injectables for tests. */
  findBlocking?: () => Promise<WorkerWindowInfo[]>;
  dismiss?: (info: WorkerWindowInfo) => Promise<boolean>;
  isPortUp?: () => Promise<boolean>;
  startProcess?: (opts: WorkerLaunchOptions) => Promise<{ pid: number }>;
  stopProcess?: (pid: number) => Promise<void>;
  now?: () => number;
}

export class WorkerSupervisor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private workerPid: number | null = null;
  private portDownSince: number | null = null;
  private ticking = false;
  private readonly opts: Required<
    Pick<
      WorkerSupervisorOptions,
      | 'pollIntervalMs'
      | 'portDownRestartMs'
      | 'modalDismissAttempts'
      | 'findBlocking'
      | 'dismiss'
      | 'isPortUp'
      | 'startProcess'
      | 'stopProcess'
      | 'now'
    >
  > &
    WorkerSupervisorOptions;

  constructor(options: WorkerSupervisorOptions) {
    this.opts = {
      ...options,
      pollIntervalMs: options.pollIntervalMs ?? 3_000,
      portDownRestartMs: options.portDownRestartMs ?? 10_000,
      modalDismissAttempts: options.modalDismissAttempts ?? 2,
      findBlocking: options.findBlocking ?? findBlockingGedeminWindows,
      dismiss: options.dismiss ?? tryDismissBlockingDialog,
      isPortUp:
        options.isPortUp ??
        (() => isLocalPortListening(options.host, options.port)),
      startProcess: options.startProcess ?? startGedeminWorkerProcess,
      stopProcess: options.stopProcess ?? stopGedeminWorkerProcess,
      now: options.now ?? Date.now,
    };
  }

  getPid(): number | null {
    return this.workerPid;
  }

  startLoop(): void {
    if (this.timer) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.opts.pollIntervalMs);
  }

  stopLoop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async ensureRunning(): Promise<void> {
    if (await this.opts.isPortUp()) {
      this.portDownSince = null;
      return;
    }
    const { pid } = await this.opts.startProcess(this.opts.launch);
    this.workerPid = pid;
    this.opts.onEvent?.({ type: 'started', pid });
  }

  /** Public restart for pool hung-handler (2.4). */
  async restart(extraPids: number[] = []): Promise<void> {
    await this.restartWorker(extraPids);
  }

  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.handleModals();
      await this.handlePort();
    } finally {
      this.ticking = false;
    }
  }

  private async handleModals(): Promise<void> {
    let blocked = await this.opts.findBlocking();
    if (blocked.length === 0) return;

    markWorkerBlocked(this.opts.now());
    this.opts.onEvent?.({ type: 'modal_seen', windows: blocked });

    for (let attempt = 0; attempt < this.opts.modalDismissAttempts; attempt++) {
      for (const w of blocked) {
        await this.opts.dismiss(w);
      }
      blocked = await this.opts.findBlocking();
      if (blocked.length === 0) {
        this.opts.onEvent?.({ type: 'modal_dismissed' });
        return;
      }
    }

    this.opts.onEvent?.({ type: 'modal_restart', windows: blocked });
    await this.restartWorker(blocked.map((w) => w.pid));
  }

  private async handlePort(): Promise<void> {
    const up = await this.opts.isPortUp();
    if (up) {
      if (this.portDownSince != null) {
        this.opts.onEvent?.({ type: 'port_up' });
      }
      this.portDownSince = null;
      return;
    }

    this.opts.onEvent?.({ type: 'port_down' });
    const now = this.opts.now();
    if (this.portDownSince == null) {
      this.portDownSince = now;
      return;
    }
    if (now - this.portDownSince < this.opts.portDownRestartMs) {
      return;
    }

    this.opts.onEvent?.({ type: 'port_restart' });
    await this.restartWorker();
    this.portDownSince = null;
  }

  private async restartWorker(extraPids: number[] = []): Promise<void> {
    const pids = new Set<number>();
    if (this.workerPid != null) pids.add(this.workerPid);
    for (const pid of extraPids) {
      if (Number.isFinite(pid) && pid > 0) pids.add(pid);
    }
    for (const pid of pids) {
      await this.opts.stopProcess(pid);
    }
    this.workerPid = null;

    const deadline = this.opts.now() + 20_000;
    while ((await this.opts.isPortUp()) && this.opts.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
    }

    const { pid } = await this.opts.startProcess(this.opts.launch);
    this.workerPid = pid;
    this.opts.onEvent?.({ type: 'started', pid });
  }
}
