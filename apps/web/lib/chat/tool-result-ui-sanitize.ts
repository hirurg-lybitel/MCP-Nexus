function parsePayload(fullPayload: string): Record<string, unknown> | null {
  try {
    const data = JSON.parse(fullPayload) as unknown;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function slimDescribeTableColumns(
  columns: unknown
): Record<string, unknown>[] {
  if (!Array.isArray(columns)) {
    return [];
  }

  return columns
    .filter(
      (col): col is Record<string, unknown> =>
        col !== null && typeof col === 'object' && !Array.isArray(col)
    )
    .map((col) => {
      const slim: Record<string, unknown> = {
        fieldName: col.fieldName,
      };
      if (col.displayName != null && String(col.displayName).trim()) {
        slim.displayName = col.displayName;
      }
      if (col.sensitive === true) {
        slim.sensitive = true;
      }
      if (col.refTable != null && String(col.refTable).trim()) {
        slim.refTable = col.refTable;
      }
      return slim;
    });
}

function sanitizeExecuteSql(payload: Record<string, unknown>): string {
  const rows = Array.isArray(payload.rows)
    ? (payload.rows as Record<string, unknown>[])
    : [];
  const rowCount =
    typeof payload.rowCount === 'number' ? payload.rowCount : rows.length;
  const truncated = Boolean(payload.truncated);
  const columns =
    rows.length > 0
      ? Object.keys(rows[0] ?? {}).sort()
      : [];

  return JSON.stringify({
    rowCount,
    columns,
    truncated,
  });
}

function sanitizeDescribeTable(payload: Record<string, unknown>): string {
  return JSON.stringify({
    tableName: payload.tableName,
    tableDisplayName: payload.tableDisplayName,
    columns: slimDescribeTableColumns(payload.columns),
  });
}

/** Strip row values from tool results shown in chat UI (security). */
export function sanitizeToolResultForUi(
  toolName: string,
  fullPayload: string
): string {
  const payload = parsePayload(fullPayload);
  if (!payload) {
    return fullPayload;
  }

  if (payload.error) {
    return fullPayload;
  }

  switch (toolName) {
  case 'execute_sql':
    return sanitizeExecuteSql(payload);
  case 'describe_table':
    return sanitizeDescribeTable(payload);
  default:
    return fullPayload;
  }
}
