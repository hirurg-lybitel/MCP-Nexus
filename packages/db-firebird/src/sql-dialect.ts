export type FirebirdSqlDialect = '2.5' | '3';

export function parseFirebirdSqlDialectValue(raw?: string): FirebirdSqlDialect {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === '3' || normalized === '30' || normalized === '3.0') {
    return '3';
  }
  return '2.5';
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
    'Do not add row-number / № / ROW_NUMBER columns — the UI prepends № for multi-row tables.',
    'Prefer SELECT FIRST n with an explicit column list and ORDER BY.',
    'Use columnLabels in present_query_result for localized titles; date/time display is handled in the UI from labels.',
    'Avoid correlated subqueries that reuse the same table alias in outer/inner queries; prefer JOINs.',
  ];

  if (dialect === '3') {
    return [
      ...shared,
      'Dialect 3: WITH (CTE) and window functions (OVER, ROW_NUMBER, …) are allowed when needed.',
    ];
  }

  return [
    ...shared,
    'Dialect 2.5: no WITH (CTE), no window functions, no RECURSIVE — use flat SELECT … FROM … JOIN … only.',
  ];
}
