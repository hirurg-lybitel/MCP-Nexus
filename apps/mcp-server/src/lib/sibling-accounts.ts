/**
 * Sibling synthetic accounts that share a short alias prefix (51, 62, 90)
 * but sit outside the LB/RB tree of the requested account.
 */

type SqlDb = {
  executeSql: {
    run: (sql: string) => Promise<{ rows: unknown[] }>;
  };
};

export type RelatedSiblingAccount = {
  accountKey: number;
  alias: string;
  name: string;
  accountType: string;
};

function asString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const raw = row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
    if (raw == null) continue;
    return String(raw);
  }
  return '';
}

function asNumber(row: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const raw = row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
    if (raw == null) continue;
    const value = typeof raw === 'bigint' ? Number(raw) : Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

/** True for short synthetic codes like 51 / 62 / 90 (not 51-1, 62.4, 90.01). */
export function isShortSyntheticAlias(alias: string): boolean {
  return /^\d{2}$/.test(String(alias ?? '').trim());
}

/** Leading two-digit account group from an alias, or null. */
export function accountGroupPrefix(alias: string): string | null {
  const m = /^(\d{2})/.exec(String(alias ?? '').trim());
  return m?.[1] ?? null;
}

export async function findRelatedSiblingAccounts(
  db: SqlDb,
  args: { accountKey: number; chartRootId: number; alias: string }
): Promise<RelatedSiblingAccount[]> {
  const alias = String(args.alias ?? '').trim();
  if (!isShortSyntheticAlias(alias)) return [];

  const prefix = accountGroupPrefix(alias);
  if (!prefix) return [];

  const esc = prefix.replace(/'/g, "''");
  const result = await db.executeSql.run(`
SELECT a.id, a.alias, a.name, a.accounttype
FROM ac_account a
JOIN ac_account root ON root.id = ${args.accountKey}
JOIN ac_account chart ON chart.id = ${args.chartRootId}
WHERE a.lb >= chart.lb
  AND a.rb <= chart.rb
  AND a.accounttype IN ('A', 'S')
  AND NOT (a.lb >= root.lb AND a.rb <= root.rb)
  AND (
    UPPER(a.alias) = UPPER('${esc}')
    OR UPPER(a.alias) STARTING WITH UPPER('${esc}.')
    OR UPPER(a.alias) STARTING WITH UPPER('${esc}-')
  )
ORDER BY a.alias`);

  const out: RelatedSiblingAccount[] = [];
  for (const row of result.rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const id = asNumber(record, 'id', 'ID');
    if (id == null) continue;
    out.push({
      accountKey: id,
      alias: asString(record, 'alias', 'ALIAS'),
      name: asString(record, 'name', 'NAME'),
      accountType: asString(record, 'accounttype', 'ACCOUNTTYPE'),
    });
  }
  return out;
}
