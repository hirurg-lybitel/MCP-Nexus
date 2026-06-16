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
import { NextResponse } from 'next/server';

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const auth = validateClientMcpAuth(
    request.headers.get('authorization'),
    request.headers.get('x-api-key')
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rateLimitKey = `present-query:${getClientRateLimitKey(request)}`;
  if (!checkRateLimit(rateLimitKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: 'Expected JSON object', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  const record = body as Record<string, unknown>;
  const sql = typeof record.sql === 'string' ? record.sql.trim() : '';
  const hasRows = Array.isArray(record.rows);

  if (!sql && !hasRows) {
    return NextResponse.json(
      { error: 'sql or rows is required', code: 'INVALID_PRESENT' },
      { status: 400 }
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
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof FirebirdConfigError) {
      return NextResponse.json(
        { error: err.message, code: 'FIREBIRD_NOT_CONFIGURED' },
        { status: 503 }
      );
    }
    if (err instanceof SensitiveColumnError) {
      return NextResponse.json(
        { error: err.message, code: 'SENSITIVE_COLUMN' },
        { status: 400 }
      );
    }
    if (err instanceof FirebirdQueryError) {
      return NextResponse.json(
        { error: err.message, code: 'QUERY_ERROR' },
        { status: 400 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message, code: 'PRESENT_FAILED' },
      { status: 500 }
    );
  }
}
