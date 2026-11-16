import type { ReportWorkerConfig } from './config.js';

export interface WorkerLoginProbeResult {
  ok: boolean;
  reachable: boolean;
  status?: number;
  /** Safe for logs — never includes password. */
  message: string;
}

/**
 * Check that the Gedemin web worker accepts the configured user.
 * Uses platform `/test?user_name=&password=` (same as start-worker.mjs).
 * Password is never returned or logged.
 */
export async function probeGedeminWorkerLogin(
  config: ReportWorkerConfig,
  timeoutMs = 5000
): Promise<WorkerLoginProbeResult> {
  const url = new URL('/test', config.baseUrl);
  url.searchParams.set('user_name', config.user);
  url.searchParams.set('password', config.password);

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = (await res.text()).trim();
    const bodyOk = /^ok$/i.test(text) || text.length === 0;
    if (res.ok && bodyOk) {
      return {
        ok: true,
        reachable: true,
        status: res.status,
        message: `worker login ok as ${config.user} @ ${config.baseUrl}`,
      };
    }
    return {
      ok: false,
      reachable: true,
      status: res.status,
      message: `worker rejected login for ${config.user} @ ${config.baseUrl} (HTTP ${res.status})`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reachable: false,
      message: `worker unreachable at ${config.baseUrl}: ${detail}`,
    };
  }
}
