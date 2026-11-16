import { wasWorkerBlockedRecently } from './block-state.js';
import type { ReportWorkerConfig } from './config.js';
import { isEmptyOkReport } from './empty-report.js';
import { ReportWorkerError } from './errors.js';

export interface WorkerSlot {
  id: number;
  baseUrl: string;
  port: number;
  busy: boolean;
  /** Soft-lock after timeout until this timestamp (ms). */
  unhealthyUntil: number;
  pid: number | null;
}

export type WorkerHungHandler = (slot: WorkerSlot) => Promise<void>;

export interface WorkerPoolOptions {
  urls: string[];
  token: string;
  requestTimeoutMs: number;
  queueTimeoutMs: number;
  /** After a hung request, slot stays unavailable at least this long. Default 15s. */
  unhealthyMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  onHung?: WorkerHungHandler;
}

interface QueueWaiter {
  resolve: (slot: WorkerSlot) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function portFromBaseUrl(baseUrl: string): number {
  try {
    const u = new URL(baseUrl);
    if (u.port) return Number.parseInt(u.port, 10);
    return u.protocol === 'https:' ? 443 : 80;
  } catch {
    return 0;
  }
}

/**
 * FIFO pool over 1–4 Gedemin worker base URLs.
 * One in-flight request per slot (platform is single-threaded per process).
 */
export class WorkerPool {
  private readonly slots: WorkerSlot[];
  private readonly queue: QueueWaiter[] = [];
  private readonly token: string;
  private readonly requestTimeoutMs: number;
  private readonly queueTimeoutMs: number;
  private readonly unhealthyMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly onHung?: WorkerHungHandler;

  constructor(options: WorkerPoolOptions) {
    if (options.urls.length < 1) {
      throw new Error('WorkerPool requires at least one worker URL');
    }
    if (options.urls.length > 4) {
      throw new Error('WorkerPool supports at most 4 workers (TZ 2.4)');
    }
    this.token = options.token;
    this.requestTimeoutMs = options.requestTimeoutMs;
    this.queueTimeoutMs = options.queueTimeoutMs;
    this.unhealthyMs = options.unhealthyMs ?? 15_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.onHung = options.onHung;
    this.slots = options.urls.map((baseUrl, id) => ({
      id,
      baseUrl: baseUrl.replace(/\/$/, ''),
      port: portFromBaseUrl(baseUrl),
      busy: false,
      unhealthyUntil: 0,
      pid: null,
    }));
  }

  static fromConfig(
    config: ReportWorkerConfig,
    onHung?: WorkerHungHandler
  ): WorkerPool {
    return new WorkerPool({
      urls: config.urls,
      token: config.token,
      requestTimeoutMs: config.timeoutMs,
      queueTimeoutMs: config.queueTimeoutMs,
      onHung,
    });
  }

  get size(): number {
    return this.slots.length;
  }

  getSlots(): readonly WorkerSlot[] {
    return this.slots;
  }

  setSlotPid(id: number, pid: number | null): void {
    const slot = this.slots[id];
    if (slot) slot.pid = pid;
  }

  /** Run a worker HTTP GET with queue + per-request timeout. */
  async request(
    path: string,
    query: Record<string, string>
  ): Promise<unknown> {
    const slot = await this.acquire();
    try {
      return await this.fetchJson(slot, path, query);
    } catch (error) {
      if (
        error instanceof ReportWorkerError &&
        (error.code === 'WORKER_TIMEOUT' || error.code === 'WORKER_UNAVAILABLE')
      ) {
        slot.unhealthyUntil = this.now() + this.unhealthyMs;
        try {
          await this.onHung?.(slot);
        } catch (hungError) {
          const message =
            hungError instanceof Error ? hungError.message : String(hungError);
          console.error(`[worker-pool] onHung failed for slot ${slot.id}: ${message}`);
        }
      }
      throw error;
    } finally {
      this.release(slot);
    }
  }

  private async acquire(): Promise<WorkerSlot> {
    const free = this.pickFree();
    if (free) {
      free.busy = true;
      return free;
    }

    return new Promise<WorkerSlot>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex((w) => w.resolve === resolve);
        if (idx >= 0) this.queue.splice(idx, 1);
        reject(
          new ReportWorkerError(
            `Worker queue timeout after ${this.queueTimeoutMs}ms (${this.slots.length} slots)`,
            'WORKER_QUEUE_TIMEOUT'
          )
        );
      }, this.queueTimeoutMs);

      this.queue.push({ resolve, reject, timer });
    });
  }

  private release(slot: WorkerSlot): void {
    slot.busy = false;
    const next = this.queue.shift();
    if (!next) return;
    clearTimeout(next.timer);
    const free = this.pickFree();
    if (!free) {
      // Should not happen — we just freed a slot; re-queue waiter.
      this.queue.unshift(next);
      return;
    }
    free.busy = true;
    next.resolve(free);
  }

  private pickFree(): WorkerSlot | undefined {
    const now = this.now();
    return this.slots.find(
      (s) => !s.busy && s.unhealthyUntil <= now
    );
  }

  private async fetchJson(
    slot: WorkerSlot,
    path: string,
    query: Record<string, string>
  ): Promise<unknown> {
    const url = new URL(path, `${slot.baseUrl}/`);
    url.searchParams.set('token', this.token);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const res = await this.fetchImpl(url, { signal: controller.signal });
      const text = await res.text();
      if (!res.ok) {
        throw new ReportWorkerError(
          text.slice(0, 500) || res.statusText,
          'WORKER_HTTP_ERROR',
          res.status
        );
      }
      let data: unknown;
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        throw new ReportWorkerError(
          `Worker returned non-JSON: ${text.slice(0, 200)}`,
          'WORKER_BAD_JSON',
          res.status
        );
      }
      if (wasWorkerBlockedRecently() && isEmptyOkReport(data)) {
        throw new ReportWorkerError(
          `Worker returned an empty report for ${path} after a blocking dialog — treat as failure, not zeros`,
          'WORKER_BLOCKED_EMPTY',
          res.status
        );
      }
      return data;
    } catch (error) {
      if (error instanceof ReportWorkerError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      if (
        (error instanceof Error && error.name === 'AbortError') ||
        /aborted/i.test(message)
      ) {
        throw new ReportWorkerError(
          `Worker request timed out after ${this.requestTimeoutMs}ms on ${slot.baseUrl}${path}`,
          'WORKER_TIMEOUT'
        );
      }
      throw new ReportWorkerError(message, 'WORKER_UNAVAILABLE');
    } finally {
      clearTimeout(timer);
    }
  }
}
