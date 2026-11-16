/**
 * Active chart of an organization: one AC_COMPANYACCOUNT row with ISACTIVE = 1.
 * The account id is whatever this database stores. There is no built-in chart id.
 */

type SqlDb = {
  executeSql: {
    run: (sql: string) => Promise<{ rows: unknown[] }>;
  };
};

export type ActiveChartResult =
  | { ok: true; accountKey: number }
  | { ok: false; code: string; message: string };

function accountKeyOf(row: unknown): number | undefined {
  if (!row || typeof row !== 'object') return undefined;
  const record = row as Record<string, unknown>;
  const raw = record.ACCOUNTKEY ?? record.accountkey;
  const value = typeof raw === 'bigint' ? Number(raw) : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export async function resolveActiveChart(
  db: SqlDb,
  companyKey: number
): Promise<ActiveChartResult> {
  const result = await db.executeSql.run(`
SELECT accountkey
FROM ac_companyaccount
WHERE companykey = ${companyKey}
  AND isactive = 1
`);
  const keys = result.rows
    .map(accountKeyOf)
    .filter((key): key is number => key != null);

  if (keys.length === 0) {
    return {
      ok: false,
      code: 'CHART_NOT_FOUND',
      message: `No active chart for company ${companyKey}. AC_COMPANYACCOUNT.ISACTIVE = 1 is required.`,
    };
  }
  if (keys.length > 1) {
    return {
      ok: false,
      code: 'AMBIGUOUS_CHART',
      message: `Company ${companyKey} has ${keys.length} active charts. Pass accountKey explicitly.`,
    };
  }
  return { ok: true, accountKey: keys[0]! };
}
