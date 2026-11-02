export interface ReportWorkerConfig {
  baseUrl: string;
  token: string;
  timeoutMs: number;
  gedeminExe: string;
  databaseAlias: string;
  user: string;
  password: string;
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

  return {
    baseUrl: env.GEDEMIN_WORKER_URL?.trim() || `http://${host}:${port}`,
    token: env.GEDEMIN_WORKER_TOKEN?.trim() || env.MCP_API_KEY?.trim() || 'mcp-worker-dev',
    timeoutMs: Number.parseInt(env.GEDEMIN_WORKER_TIMEOUT_MS ?? '120000', 10) || 120_000,
    gedeminExe:
      env.GEDEMIN_WORKER_EXE?.trim() || 'D:\\Soft\\gedemin-worker\\gedemin.exe',
    databaseAlias: env.GEDEMIN_WORKER_DB_ALIAS?.trim() || 'CRM_WORKER',
    user,
    password,
  };
}
