import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/server';

export type AuditTransport = 'stdio' | 'http' | 'unknown';

export interface AuditRecord {
  ts: string;
  durationMs: number;
  transport: AuditTransport;
  user: string;
  tool: string;
  args: unknown;
  sql: string | null;
  rowCount: number | null;
  ok: boolean;
  errorCode: string | null;
}

const SECRET_KEY_RE =
  /pass(word|wd)?|secret|token|authorization|api[_-]?key|mcp_api_key|bearer/i;

let transport: AuditTransport = 'unknown';

export function setAuditTransport(next: AuditTransport): void {
  transport = next;
}

export function getAuditTransport(): AuditTransport {
  return transport;
}

export function resolveAuditUser(
  env: NodeJS.ProcessEnv = process.env
): string {
  return (
    env.GEDEMIN_WORKER_USER?.trim() ||
    env.ISC_USER?.trim() ||
    'local'
  );
}

export function resolveAuditLogPath(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd()
): string {
  const configured = env.MCP_AUDIT_LOG?.trim();
  if (configured) return configured;
  return resolve(cwd, 'logs', 'mcp-audit.jsonl');
}

export function isAuditEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.MCP_AUDIT?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  return true;
}

export function redactArgs(value: unknown, key = ''): unknown {
  if (key && SECRET_KEY_RE.test(key)) {
    return '[redacted]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactArgs(item));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactArgs(v, k);
    }
    return out;
  }
  return value;
}

export function extractSql(tool: string, args: unknown): string | null {
  if (tool !== 'run_sql') return null;
  if (!args || typeof args !== 'object') return null;
  const sql = (args as { sql?: unknown }).sql;
  return typeof sql === 'string' ? sql : null;
}

export function extractRowCount(result: unknown): number | null {
  if (!result || typeof result !== 'object') return null;
  const sc = (result as { structuredContent?: unknown }).structuredContent;
  const payload =
    sc && typeof sc === 'object'
      ? (sc as Record<string, unknown>)
      : (result as Record<string, unknown>);

  if (typeof payload.rowCount === 'number') return payload.rowCount;
  if (Array.isArray(payload.rows)) return payload.rows.length;
  if (Array.isArray(payload.entries)) return payload.entries.length;
  if (Array.isArray(payload.accounts)) return payload.accounts.length;
  if (Array.isArray(payload.configs)) return payload.configs.length;
  if (Array.isArray(payload.documents)) return payload.documents.length;
  return null;
}

export function extractOkAndCode(result: unknown): {
  ok: boolean;
  errorCode: string | null;
} {
  if (!result || typeof result !== 'object') {
    return { ok: true, errorCode: null };
  }
  const r = result as {
    isError?: boolean;
    structuredContent?: { error?: unknown; code?: unknown };
  };
  if (r.isError) {
    const code = r.structuredContent?.code;
    return {
      ok: false,
      errorCode: typeof code === 'string' ? code : 'TOOL_ERROR',
    };
  }
  const sc = r.structuredContent;
  if (sc && typeof sc.error === 'string') {
    return {
      ok: false,
      errorCode: typeof sc.code === 'string' ? sc.code : 'TOOL_ERROR',
    };
  }
  return { ok: true, errorCode: null };
}

export async function appendAuditRecord(
  record: AuditRecord,
  options: {
    logPath?: string;
    alsoStderr?: boolean;
    env?: NodeJS.ProcessEnv;
  } = {}
): Promise<void> {
  const env = options.env ?? process.env;
  if (!isAuditEnabled(env)) return;

  const line = `${JSON.stringify(record)}\n`;
  const logPath = options.logPath ?? resolveAuditLogPath(env);
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, line, 'utf8');

  const alsoStderr =
    options.alsoStderr ??
    ['1', 'true', 'yes', 'on'].includes(
      (env.MCP_AUDIT_STDERR ?? '').trim().toLowerCase()
    );
  if (alsoStderr) {
    console.error(`[audit] ${line.trimEnd()}`);
  }
}

// MCP tool handlers vary by arity; keep the wrapper loosely typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolHandler = (...handlerArgs: any[]) => any;

/**
 * Wrap a tool handler so every call appends one JSONL audit record.
 * Failures writing the log are swallowed (logged to stderr) so tools keep working.
 */
export function withAudit<H extends AnyToolHandler>(
  toolName: string,
  handler: H,
  options: {
    env?: NodeJS.ProcessEnv;
    logPath?: string;
    now?: () => number;
  } = {}
): H {
  const wrapped = (async (...handlerArgs: Parameters<H>) => {
    const env = options.env ?? process.env;
    const started = (options.now ?? Date.now)();
    const args = handlerArgs[0];
    let result: unknown;
    let thrown: unknown;

    try {
      result = await Promise.resolve(handler(...handlerArgs));
      return result;
    } catch (error) {
      thrown = error;
      throw error;
    } finally {
      const durationMs = (options.now ?? Date.now)() - started;
      const { ok, errorCode } = thrown
        ? {
            ok: false,
            errorCode:
              thrown instanceof Error && thrown.name
                ? thrown.name
                : 'UNCAUGHT',
          }
        : extractOkAndCode(result);

      const record: AuditRecord = {
        ts: new Date(started).toISOString(),
        durationMs,
        transport: getAuditTransport(),
        user: resolveAuditUser(env),
        tool: toolName,
        args: redactArgs(args),
        sql: extractSql(toolName, args),
        rowCount: thrown ? null : extractRowCount(result),
        ok,
        errorCode,
      };

      try {
        await appendAuditRecord(record, {
          env,
          logPath: options.logPath,
        });
      } catch (logError) {
        const message =
          logError instanceof Error ? logError.message : String(logError);
        console.error(`[audit] failed to write log: ${message}`);
      }
    }
  }) as H;

  return wrapped;
}

/** Patch server.registerTool so every registered tool is audited. */
export function installToolAudit(server: McpServer): void {
  const original = server.registerTool.bind(server);
  (
    server as unknown as {
      registerTool: (...args: unknown[]) => unknown;
    }
  ).registerTool = (name: unknown, config: unknown, handler: unknown) => {
    if (typeof name !== 'string' || typeof handler !== 'function') {
      return original(
        name as never,
        config as never,
        handler as never
      );
    }
    return original(
      name as never,
      config as never,
      withAudit(name, handler as AnyToolHandler) as never
    );
  };
}
