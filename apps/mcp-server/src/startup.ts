import { loadFirebirdConfig } from '@mcp-nexus/db-firebird';
import {
  loadReportWorkerConfig,
  probeGedeminWorkerLogin,
} from '@mcp-nexus/report-worker';
import { getMcpApiKey } from './auth.js';

export type StartupMode = 'http' | 'stdio';

export class StartupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StartupError';
  }
}

/** Required env for both transports. Throws StartupError with a clear message. */
export function assertStartupEnv(
  mode: StartupMode,
  env: NodeJS.ProcessEnv = process.env
): void {
  const fb = loadFirebirdConfig(env);
  if (!fb) {
    throw new StartupError(
      'Firebird is not configured. Set NODE_FB_HOST, NODE_FB_PORT, NODE_FB_DB, ISC_USER, ISC_PASSWORD.'
    );
  }

  if (mode === 'http' && !getMcpApiKey(env)) {
    throw new StartupError(
      'HTTP mode requires MCP_API_KEY (Authorization: Bearer <key>).'
    );
  }
}

export interface WorkerStartupStatus {
  configured: boolean;
  ok: boolean;
  reachable: boolean;
  message: string;
}

/**
 * If worker credentials are set, probe Gedemin `/test` login.
 * Missing credentials → configured:false (report tools will fail later).
 * Unreachable / bad login → ok:false with a safe message (no password).
 */
export async function checkWorkerLogin(
  env: NodeJS.ProcessEnv = process.env,
  timeoutMs = 5000
): Promise<WorkerStartupStatus> {
  const config = loadReportWorkerConfig(env);
  if (!config) {
    return {
      configured: false,
      ok: false,
      reachable: false,
      message:
        'GEDEMIN_WORKER_USER / GEDEMIN_WORKER_PASSWORD not set; report tools unavailable',
    };
  }

  const result = await probeGedeminWorkerLogin(config, timeoutMs);
  return {
    configured: true,
    ok: result.ok,
    reachable: result.reachable,
    message: result.message,
  };
}

/**
 * Log worker probe to stderr (stdio-safe). Does not exit on failure —
 * worker may start later; SQL tools still work.
 */
export async function logWorkerStartupCheck(
  env: NodeJS.ProcessEnv = process.env
): Promise<WorkerStartupStatus> {
  const status = await checkWorkerLogin(env);
  if (!status.configured) {
    console.error(`[startup] ${status.message}`);
  } else if (status.ok) {
    console.error(`[startup] ${status.message}`);
  } else {
    console.error(`[startup] WARNING: ${status.message}`);
  }
  return status;
}
