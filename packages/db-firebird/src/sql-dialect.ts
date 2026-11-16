/**
 * SQL feature profile for read-only queries.
 * Target runtime is Firebird 5.0 (D2 / D20). Profile '3' unlocks CTE, windows,
 * WITH RECURSIVE, OFFSET/FETCH — the Firebird 3+ SQL surface used on FB5.
 * Profile '2.5' remains only as an explicit local override for guard tests;
 * client deployments on 2.5 must upgrade the database to Firebird 5.
 */
export type FirebirdSqlDialect = '2.5' | '3';

export function parseFirebirdSqlDialectValue(raw?: string): FirebirdSqlDialect {
  const normalized = raw?.trim().toLowerCase();
  if (
    normalized === '2.5' ||
    normalized === '25' ||
    normalized === '2' ||
    normalized === '2.1'
  ) {
    return '2.5';
  }
  // Default and Firebird 3 / 4 / 5: full modern SQL
  return '3';
}

/** Reads FIREBIRD_SQL_DIALECT (server) or NEXT_PUBLIC_FIREBIRD_SQL_DIALECT (client prompt). */
export function parseFirebirdSqlDialect(
  env: NodeJS.ProcessEnv = process.env
): FirebirdSqlDialect {
  const raw =
    env.NEXT_PUBLIC_FIREBIRD_SQL_DIALECT ?? env.FIREBIRD_SQL_DIALECT;
  return parseFirebirdSqlDialectValue(raw);
}

export function describeFirebirdSqlDialect(dialect: FirebirdSqlDialect): string[] {
  const shared = [
    'Target engine is Firebird 5.0. Clients on Firebird 2.5 must upgrade the database.',
    'Do not add row-number / № / ROW_NUMBER columns unless the analysis needs them — the UI may prepend № for multi-row tables.',
    'Prefer SELECT FIRST n or OFFSET/FETCH with an explicit column list and ORDER BY.',
    'Use columnLabels in present_query_result for localized titles; date/time display is handled in the UI from labels.',
    'Avoid correlated subqueries that reuse the same table alias in outer/inner queries; prefer JOINs.',
  ];

  if (dialect === '3') {
    return [
      ...shared,
      'Firebird 5 SQL: WITH / WITH RECURSIVE, window functions (OVER, ROW_NUMBER, …), OFFSET/FETCH are allowed when needed.',
      'Do not use LIMIT (not supported); use SELECT FIRST n or OFFSET … FETCH.',
    ];
  }

  return [
    ...shared,
    'Legacy dialect 2.5 override: non-recursive WITH (CTE) only; no window functions, no WITH RECURSIVE, no OFFSET/FETCH. Not supported for client deployments.',
  ];
}
