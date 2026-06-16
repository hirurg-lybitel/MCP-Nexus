import { isSensitiveColumn } from '@mcp-nexus/db-firebird/sensitive-field-compat';
import { isRdbKeyField, type TableKeyFields } from './table-key-fields';

/** Default number of columns shown in the UI table (full data stays in tool JSON for the model). */
export const DEFAULT_DISPLAY_COLUMN_LIMIT = 8;

const PRIORITY_EXACT: Record<string, number> = {
  NAME: 95,
  TITLE: 90,
  SHORTNAME: 88,
  ALIAS: 85,
  CODE: 82,
  NUMBER: 80,
  NUM: 80,
  DATE: 78,
  DATETIME: 76,
  STATUS: 74,
  STATE: 72,
  TYPE: 70,
  DESCRIPTION: 65,
  NOTE: 60,
  COMMENT: 58,
  EMAIL: 55,
  PHONE: 55,
  ADDRESS: 52,
  SUM: 50,
  QTY: 50,
  QUANTITY: 50,
  PRICE: 50,
  AMOUNT: 50,
};

/** Primary / foreign keys and internal refs — hidden in UI unless user asks. */
const IDENTIFIER_PATTERNS: RegExp[] = [
  /^ID$/i,
  /_ID$/i,
  /_KEY$/i,
  /^KEY$/i,
  /GROUPKEY$/i,
  /OWNERKEY$/i,
  /PARENTKEY$/i,
  /_FK$/i,
  /^FK_/i,
  /_REF$/i,
  /_GUID$/i,
  /_RUID$/i,
];

const DEPRIORITY_PATTERNS: RegExp[] = [
  /USN$/i,
  /GUID$/i,
  /RUID$/i,
  /GROUPKEY$/i,
  /OWNERKEY$/i,
  /PARENTKEY$/i,
  /PARENT$/i,
  /BLR$/i,
  /BLOB$/i,
  /HASH$/i,
  /CHECKSUM$/i,
  /VERSION$/i,
  /FLAGS$/i,
  /SORTORDER$/i,
  /SORT_ORDER$/i,
];

function normalizeKey(key: string): string {
  return key.trim().toUpperCase();
}

export function isIdentifierColumn(key: string): boolean {
  const upper = normalizeKey(key);
  return IDENTIFIER_PATTERNS.some((re) => re.test(upper));
}

/** Columns omitted from the default UI subset. */
export function isHiddenByDefaultColumn(
  key: string,
  keyFields?: TableKeyFields
): boolean {
  const upper = normalizeKey(key);

  if (isSensitiveColumn(key)) {
    return true;
  }

  if (keyFields) {
    if (isRdbKeyField(key, keyFields)) {
      return true;
    }
    return DEPRIORITY_PATTERNS.some((re) => re.test(upper));
  }

  return (
    isIdentifierColumn(key) ||
    DEPRIORITY_PATTERNS.some((re) => re.test(upper))
  );
}

function scoreColumnName(key: string, keyFields?: TableKeyFields): number {
  const upper = normalizeKey(key);
  if (keyFields ? isRdbKeyField(key, keyFields) : isIdentifierColumn(key)) {
    return 1;
  }

  if (PRIORITY_EXACT[upper] != null) {
    return PRIORITY_EXACT[upper];
  }

  for (const [name, score] of Object.entries(PRIORITY_EXACT)) {
    if (name === 'ID') {
      continue;
    }
    if (upper.endsWith(`_${name}`) || upper.includes(`_${name}_`)) {
      return score - 5;
    }
  }

  if (DEPRIORITY_PATTERNS.some((re) => re.test(upper))) {
    return 5;
  }

  if (upper.length <= 12) {
    return 40;
  }

  return 25;
}

function isMostlyEmpty(values: unknown[]): boolean {
  const nonEmpty = values.filter(
    (v) => v != null && String(v).trim() !== ''
  ).length;
  return nonEmpty === 0;
}

function collectColumnKeys(rows: Record<string, unknown>[]): string[] {
  const keys = new Set<string>();
  for (const row of rows.slice(0, 25)) {
    Object.keys(row).forEach((k) => keys.add(k));
  }
  return Array.from(keys);
}

/**
 * Picks a small set of human-meaningful columns for UI display.
 * Full row objects from SQL are unchanged in the tool payload sent to the model.
 */
export function pickDisplayColumns(
  rows: Record<string, unknown>[],
  limit = DEFAULT_DISPLAY_COLUMN_LIMIT,
  keyFields?: TableKeyFields
): string[] {
  if (rows.length === 0) {
    return [];
  }

  const keys = collectColumnKeys(rows);

  const scored = keys
    .map((key) => {
      const values = rows.map((row) => row[key]);
      let score = scoreColumnName(key, keyFields);
      if (isMostlyEmpty(values)) {
        score -= 50;
      }
      return { key, score };
    })
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));

  const visible = scored.filter(
    (s) => !isHiddenByDefaultColumn(s.key, keyFields)
  );
  const picked = visible.slice(0, limit).map((s) => s.key);

  if (picked.length > 0) {
    return picked;
  }

  // Query returned only hidden columns — show top-scored columns anyway.
  return scored.slice(0, limit).map((s) => s.key);
}

export function projectRowsToColumns(
  rows: Record<string, unknown>[],
  columns: string[]
): Record<string, unknown>[] {
  return rows.map((row) => {
    const projected: Record<string, unknown> = {};
    for (const col of columns) {
      if (col in row) {
        projected[col] = row[col];
      }
    }
    return projected;
  });
}

export function buildDisplayTableFromRows(
  rows: Record<string, unknown>[],
  options?: {
    limit?: number;
    title?: string;
    meta?: TableDisplayMeta;
    keyFields?: TableKeyFields;
  }
): {
  columns: string[];
  rows: Record<string, unknown>[];
  allColumnCount: number;
  hiddenColumnCount: number;
  title: string;
} {
  const allKeys = collectColumnKeys(rows);
  const displayColumns = pickDisplayColumns(
    rows,
    options?.limit,
    options?.keyFields
  );
  const hiddenColumnCount = Math.max(0, allKeys.length - displayColumns.length);

  let title = options?.title ?? 'Query result';
  if (hiddenColumnCount > 0) {
    title = `${title} (${displayColumns.length} of ${allKeys.length} columns)`;
  }

  return {
    columns: displayColumns,
    rows: projectRowsToColumns(rows, displayColumns),
    allColumnCount: allKeys.length,
    hiddenColumnCount,
    title,
  };
}

export type TableDisplayMeta = {
  rowCount?: number;
  truncated?: boolean;
  hiddenColumnCount?: number;
  allColumnCount?: number;
};
