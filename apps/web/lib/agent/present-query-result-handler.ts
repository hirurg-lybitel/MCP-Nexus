import { enrichPresentQueryResult } from '@/lib/agent/present-query-result.server';
import {
  checkRateLimit,
  getClientRateLimitKey,
  isSameOriginRequest,
  validateClientMcpAuth,
} from '@/lib/mcp/auth';
import {
  FirebirdConfigError,
  FirebirdQueryError,
  SensitiveColumnError,
} from '@mcp-nexus/db-firebird';

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handlePresentQueryResultPost(
  request: Request
): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  const auth = validateClientMcpAuth(
    request.headers.get('authorization'),
    request.headers.get('x-api-key')
  );
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  const rateLimitKey = `present-query:${getClientRateLimitKey(request)}`;
  if (!checkRateLimit(rateLimitKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return jsonResponse({ error: 'Too many requests' }, 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      400
    );
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse(
      { error: 'Expected JSON object', code: 'INVALID_BODY' },
      400
    );
  }

  const record = body as Record<string, unknown>;
  const sql = typeof record.sql === 'string' ? record.sql.trim() : '';
  const hasRows = Array.isArray(record.rows);

  if (!sql && !hasRows) {
    return jsonResponse(
      { error: 'sql or rows is required', code: 'INVALID_PRESENT' },
      400
    );
  }

  const columnLabels =
    record.columnLabels &&
    typeof record.columnLabels === 'object' &&
    !Array.isArray(record.columnLabels)
      ? Object.fromEntries(
          Object.entries(record.columnLabels as Record<string, unknown>).filter(
            (entry): entry is [string, string] =>
              typeof entry[1] === 'string' && entry[1].trim().length > 0
          )
        )
      : undefined;

  const params =
    record.params &&
    typeof record.params === 'object' &&
    !Array.isArray(record.params)
      ? (record.params as Record<string, unknown>)
      : undefined;

  try {
    const payload = await enrichPresentQueryResult({
      title: typeof record.title === 'string' ? record.title : undefined,
      tableName:
        typeof record.tableName === 'string' ? record.tableName : undefined,
      sql: sql || undefined,
      params,
      rows: hasRows
        ? (record.rows as Record<string, unknown>[]).filter(
            (r) => r && typeof r === 'object' && !Array.isArray(r)
          )
        : undefined,
      columnLabels,
      rowCount:
        typeof record.rowCount === 'number' ? record.rowCount : undefined,
      truncated:
        typeof record.truncated === 'boolean' ? record.truncated : undefined,
    });
    return jsonResponse(payload);
  } catch (err) {
    if (err instanceof FirebirdConfigError) {
      return jsonResponse(
        { error: err.message, code: 'FIREBIRD_NOT_CONFIGURED' },
        503
      );
    }
    if (err instanceof SensitiveColumnError) {
      return jsonResponse(
        { error: err.message, code: 'SENSITIVE_COLUMN' },
        400
      );
    }
    if (err instanceof FirebirdQueryError) {
      return jsonResponse(
        { error: err.message, code: 'QUERY_ERROR' },
        400
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message, code: 'PRESENT_FAILED' }, 500);
  }
}
