import {
  FirebirdConfigError,
  FirebirdQueryError,
  requireDbServices,
} from '@mcp-nexus/db-firebird';

const MAX_PRESENT_ROWS = 500;

export interface PresentQueryResultInput {
  title?: string;
  tableName?: string;
  sql?: string;
  params?: Record<string, unknown>;
  rows?: Record<string, unknown>[];
  columnLabels?: Record<string, string>;
  rowCount?: number;
  truncated?: boolean;
}

export async function enrichPresentQueryResult(
  input: PresentQueryResultInput
): Promise<Record<string, unknown>> {
  let rowObjects: Record<string, unknown>[];
  let rowCount = input.rowCount;
  let truncated = input.truncated;

  const sql = input.sql?.trim();
  if (sql) {
    const db = requireDbServices();
    const result = await db.runValidatedQuery.run(sql, input.params);
    rowObjects = result.rows;
    rowCount = result.rowCount;
    truncated = result.truncated;
  } else if (Array.isArray(input.rows)) {
    console.warn(
      'present_query_result: rows is deprecated — pass sql (and optional params) instead.'
    );
    rowObjects = input.rows.filter(
      (r) => r && typeof r === 'object' && !Array.isArray(r)
    );
    rowCount = rowCount ?? rowObjects.length;
  } else {
    throw new FirebirdQueryError(
      'Either sql or rows is required for present_query_result.'
    );
  }

  const capped =
    rowObjects.length > MAX_PRESENT_ROWS
      ? rowObjects.slice(0, MAX_PRESENT_ROWS)
      : rowObjects;

  const normalizedTable = input.tableName?.trim().toUpperCase();
  let mergedLabels: Record<string, string> = { ...(input.columnLabels ?? {}) };
  let keyFields: { primaryKey: string[]; foreignKey: string[] } | undefined;

  if (normalizedTable && capped.length > 0) {
    try {
      const db = requireDbServices();
      const fieldNames = Object.keys(capped[0] ?? {});

      const [fromAt, constraints] = await Promise.all([
        db.resolveFieldLabels.run(normalizedTable, fieldNames),
        db.getTableFieldConstraints.run(normalizedTable),
      ]);

      mergedLabels = { ...fromAt, ...mergedLabels };

      if (
        constraints.primaryKey.length > 0 ||
        constraints.foreignKey.length > 0
      ) {
        keyFields = {
          primaryKey: constraints.primaryKey,
          foreignKey: constraints.foreignKey,
        };
      }
    } catch (err) {
      if (err instanceof FirebirdConfigError) {
        throw err;
      }
    }
  }

  let resolvedTitle = input.title?.trim();
  if (!resolvedTitle && normalizedTable) {
    try {
      const db = requireDbServices();
      const tableLabel = await db.getTableDisplayName.run(normalizedTable);
      if (tableLabel) {
        resolvedTitle = tableLabel;
      }
    } catch {
      // ignore
    }
  }

  const payload: Record<string, unknown> = {
    title: resolvedTitle,
    tableName: normalizedTable,
    rows: capped,
    rowCount: rowCount ?? rowObjects.length,
    truncated: Boolean(truncated) || rowObjects.length > MAX_PRESENT_ROWS,
  };

  if (Object.keys(mergedLabels).length > 0) {
    payload.columnLabels = mergedLabels;
  }

  if (keyFields) {
    payload.keyFields = keyFields;
  }

  return payload;
}
