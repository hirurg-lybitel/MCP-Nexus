/**
 * Resolve AC_ACCOUNT.NAME for aliases returned by worker reports
 * (AccReview / AccCard / OSB often ship alias without name).
 */

type SqlDb = {
  executeSql: {
    run: (sql: string) => Promise<{ rows: unknown[] }>;
  };
};

export type AccountMeta = {
  alias: string;
  name: string;
  offbalance: number;
};

export type AccountNameIndex = {
  byAlias: Map<string, string>;
  byId: Map<number, AccountMeta>;
  offbalanceByAlias: Map<string, number>;
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

export function normalizeAccountAlias(alias: string): string {
  return String(alias ?? '')
    .trim()
    .toUpperCase();
}

export async function loadAccountNameIndex(
  db: SqlDb,
  chartRootId: number
): Promise<AccountNameIndex> {
  const result = await db.executeSql.run(`
SELECT a.id, a.alias, a.name, a.offbalance
FROM ac_account a
JOIN ac_account chart ON chart.id = ${chartRootId}
WHERE a.lb >= chart.lb
  AND a.rb <= chart.rb
  AND a.accounttype IN ('A', 'S')`);

  const byAlias = new Map<string, string>();
  const byId = new Map<number, AccountMeta>();
  const offbalanceByAlias = new Map<string, number>();
  for (const row of result.rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const id = asNumber(record, 'id', 'ID');
    const alias = asString(record, 'alias', 'ALIAS');
    const name = asString(record, 'name', 'NAME');
    const offRaw = record.offbalance ?? record.OFFBALANCE ?? 0;
    const offNum =
      typeof offRaw === 'bigint'
        ? Number(offRaw)
        : Number(offRaw);
    const offbalance = Number.isFinite(offNum) && offNum !== 0 ? 1 : 0;
    if (id != null) byId.set(id, { alias, name, offbalance });
    const key = normalizeAccountAlias(alias);
    if (key) {
      byAlias.set(key, name);
      offbalanceByAlias.set(key, offbalance);
    }
  }
  return { byAlias, byId, offbalanceByAlias };
}

export function lookupAccountName(
  index: AccountNameIndex,
  alias: string | null | undefined
): string {
  const key = normalizeAccountAlias(String(alias ?? ''));
  if (!key || key === '(NONE)') return '';
  return index.byAlias.get(key) ?? '';
}

export function lookupAccountNameById(
  index: AccountNameIndex,
  accountId: number | null | undefined
): string {
  if (accountId == null || !Number.isFinite(accountId) || accountId <= 0) {
    return '';
  }
  return index.byId.get(accountId)?.name ?? '';
}

export function lookupAccountOffbalance(
  index: AccountNameIndex,
  alias: string | null | undefined,
  accountId?: number | null
): number {
  if (accountId != null && Number.isFinite(accountId) && accountId > 0) {
    const byId = index.byId.get(accountId);
    if (byId) return byId.offbalance;
  }
  const key = normalizeAccountAlias(String(alias ?? ''));
  if (!key || key === '(NONE)') return 0;
  return index.offbalanceByAlias.get(key) ?? 0;
}
