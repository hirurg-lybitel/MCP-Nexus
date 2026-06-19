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
  let columnMeta: Record<string, Record<string, unknown>> | undefined;

  if (normalizedTable && capped.length > 0) {
    try {
      const db = requireDbServices();
      const fieldNames = Object.keys(capped[0] ?? {});
      const wantedKeys = new Set(
        fieldNames.map((name) => name.trim().toUpperCase()).filter(Boolean)
      );

      const [fromAt, constraints, described] = await Promise.all([
        db.resolveFieldLabels.run(normalizedTable, fieldNames),
        db.getTableFieldConstraints.run(normalizedTable),
        db.describeTable.run(normalizedTable),
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

      const builtColumnMeta: Record<string, Record<string, unknown>> = {};
      for (const col of described.columns) {
        const upper = col.fieldName.trim().toUpperCase();
        if (!wantedKeys.has(upper)) {
          continue;
        }
        const entry: Record<string, unknown> = {};
        if (col.fieldType != null && String(col.fieldType).trim()) {
          entry.fieldType = col.fieldType;
        }
        if (typeof col.fieldLength === 'number') {
          entry.fieldLength = col.fieldLength;
        }
        if (col.refTable != null && String(col.refTable).trim()) {
          entry.refTable = col.refTable;
        }
        if (col.refListField != null && String(col.refListField).trim()) {
          entry.refListField = col.refListField;
        }
        if (col.constraintType === 'PRIMARY KEY' || col.constraintType === 'FOREIGN KEY') {
          entry.constraintType = col.constraintType;
        }
        if (Object.keys(entry).length > 0) {
          builtColumnMeta[col.fieldName] = entry;
          builtColumnMeta[upper] = entry;
        }
      }

      if (Object.keys(builtColumnMeta).length > 0) {
        columnMeta = builtColumnMeta;
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

  if (columnMeta && Object.keys(columnMeta).length > 0) {
    payload.columnMeta = columnMeta;
  }

  if (sql) {
    payload.sql = sql;
  }

  if (input.params && Object.keys(input.params).length > 0) {
    payload.params = input.params;
  }

  return payload;
}
