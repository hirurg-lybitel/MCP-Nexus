import { enrichPresentQueryResult } from '@/lib/agent/present-query-result.server';
import { FirebirdConfigError } from '@mcp-nexus/db-firebird';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
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
  const rows = record.rows;
  if (!Array.isArray(rows)) {
    return NextResponse.json(
      { error: 'rows array is required', code: 'INVALID_PRESENT' },
      { status: 400 }
    );
  }

  const rowObjects = rows.filter(
    (r) => r && typeof r === 'object' && !Array.isArray(r)
  ) as Record<string, unknown>[];

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

  try {
    const payload = await enrichPresentQueryResult({
      title: typeof record.title === 'string' ? record.title : undefined,
      tableName:
        typeof record.tableName === 'string' ? record.tableName : undefined,
      rows: rowObjects,
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
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message, code: 'PRESENT_FAILED' },
      { status: 500 }
    );
  }
}
