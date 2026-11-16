export interface ReportWorkerConfig {
  /** Primary / first worker URL (compat). */
  baseUrl: string;
  /** All pool URLs (1–4). */
  urls: string[];
  token: string;
  /** Per-request HTTP timeout. */
  timeoutMs: number;
  /** Max wait for a free pool slot. */
  queueTimeoutMs: number;
  poolSize: number;
  gedeminExe: string;
  databaseAlias: string;
  user: string;
  password: string;
}

/** Resolve 1–4 worker URLs from env. */
export function resolveWorkerUrls(
  env: NodeJS.ProcessEnv = process.env,
  fallbackBaseUrl?: string
): string[] {
  const listed = env.GEDEMIN_WORKER_URLS?.trim();
  if (listed) {
    const urls = listed
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (urls.length < 1 || urls.length > 4) {
      throw new Error(
        'GEDEMIN_WORKER_URLS must list 1–4 comma-separated http://127.0.0.1:port URLs'
      );
    }
    return urls;
  }

  const host = env.GEDEMIN_WORKER_HOST?.trim() || '127.0.0.1';
  const basePort =
    Number.parseInt(
      env.GEDEMIN_WORKER_BASE_PORT?.trim() ||
        env.GEDEMIN_WORKER_PORT?.trim() ||
        '9080',
      10
    ) || 9080;
  let size = Number.parseInt(env.GEDEMIN_WORKER_POOL_SIZE ?? '1', 10);
  if (!Number.isFinite(size) || size < 1) size = 1;
  if (size > 4) size = 4;

  if (size === 1 && fallbackBaseUrl) {
    return [fallbackBaseUrl.replace(/\/$/, '')];
  }

  const urls: string[] = [];
  for (let i = 0; i < size; i++) {
    urls.push(`http://${host}:${basePort + i}`);
  }
  return urls;
}

export function loadReportWorkerConfig(
  env: NodeJS.ProcessEnv = process.env
): ReportWorkerConfig | null {
  const user = env.GEDEMIN_WORKER_USER?.trim();
  const password = env.GEDEMIN_WORKER_PASSWORD ?? '';
  if (!user || !password) {
    return null;
  }

  const port = env.GEDEMIN_WORKER_PORT?.trim() || '9080';
  const host = env.GEDEMIN_WORKER_HOST?.trim() || '127.0.0.1';
  const baseUrl =
    env.GEDEMIN_WORKER_URL?.trim() || `http://${host}:${port}`;

  let urls: string[];
  try {
    urls = resolveWorkerUrls(env, baseUrl);
  } catch {
    urls = [baseUrl.replace(/\/$/, '')];
  }

  const timeoutMs =
    Number.parseInt(env.GEDEMIN_WORKER_TIMEOUT_MS ?? '120000', 10) || 120_000;
  const queueTimeoutMs =
    Number.parseInt(env.GEDEMIN_WORKER_QUEUE_TIMEOUT_MS ?? '180000', 10) ||
    180_000;

  return {
    baseUrl: urls[0]!,
    urls,
    token:
      env.GEDEMIN_WORKER_TOKEN?.trim() ||
      env.MCP_API_KEY?.trim() ||
      'mcp-worker-dev',
    timeoutMs,
    queueTimeoutMs,
    poolSize: urls.length,
    gedeminExe:
      env.GEDEMIN_WORKER_EXE?.trim() || 'D:\\Soft\\gedemin-worker\\gedemin.exe',
    databaseAlias: env.GEDEMIN_WORKER_DB_ALIAS?.trim() || 'WORKER_DB',
    user,
    password,
  };
}
