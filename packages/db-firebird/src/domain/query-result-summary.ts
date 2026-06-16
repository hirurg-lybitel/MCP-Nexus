export const MAX_SAMPLE_ROWS = 5;

export interface QueryResultSummary {
  ok: true;
  rowCount: number;
  columns: string[];
  truncated: boolean;
  sampleRows?: Record<string, unknown>[];
}

export function summarizeQueryResult(
  rows: Record<string, unknown>[],
  rowCount: number,
  truncated: boolean
): QueryResultSummary {
  const columns =
    rows.length > 0 ? Object.keys(rows[0] ?? {}).sort() : [];

  const summary: QueryResultSummary = {
    ok: true,
    rowCount,
    columns,
    truncated,
  };

  if (rows.length > 0) {
    summary.sampleRows = rows.slice(0, MAX_SAMPLE_ROWS);
  }

  return summary;
}
