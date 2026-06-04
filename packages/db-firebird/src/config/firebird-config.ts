export interface IFirebirdConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  maxRows: number;
  queryTimeoutMs: number;
}

export function buildConnectionString(config: Pick<IFirebirdConfig, 'host' | 'port' | 'database'>): string {
  return `${config.host}/${config.port}:${config.database}`;
}

export function loadFirebirdConfig(env: NodeJS.ProcessEnv = process.env): IFirebirdConfig | null {
  const host = env.NODE_FB_HOST?.trim();
  const portRaw = env.NODE_FB_PORT?.trim();
  const database = env.NODE_FB_DB?.trim();
  const username = env.ISC_USER?.trim();
  const password = env.ISC_PASSWORD ?? '';

  if (!host || !portRaw || !database || !username) {
    return null;
  }

  const port = Number.parseInt(portRaw, 10);
  if (!Number.isFinite(port) || port <= 0) {
    return null;
  }

  const maxRows = Number.parseInt(env.FIREBIRD_MAX_ROWS ?? '500', 10);
  const queryTimeoutMs = Number.parseInt(env.FIREBIRD_QUERY_TIMEOUT_MS ?? '30000', 10);

  return {
    host,
    port,
    database,
    username,
    password,
    maxRows: Number.isFinite(maxRows) && maxRows > 0 ? maxRows : 500,
    queryTimeoutMs: Number.isFinite(queryTimeoutMs) && queryTimeoutMs > 0 ? queryTimeoutMs : 30_000,
  };
}
