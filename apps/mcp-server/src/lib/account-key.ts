/**
 * Validate accountKey against AC_ACCOUNT.
 * Models often pass an alias (60, 62) as id; those must not silently return zero saldo.
 */

type SqlDb = {
  executeSql: {
    run: (sql: string) => Promise<{ rows: unknown[] }>;
  };
};

export type AccountRef = {
  accountKey: number;
  alias: string;
  name: string;
};

export type AccountKeyOk = {
  ok: true;
  accountKey: number;
  alias: string;
  name: string;
};

export type AccountKeyErr = {
  ok: false;
  code: 'ACCOUNT_NOT_FOUND';
  message: string;
};

export type AccountKeyResult = AccountKeyOk | AccountKeyErr;

function asNumber(row: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const raw = row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
    if (raw == null) continue;
    const value = typeof raw === 'bigint' ? Number(raw) : Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

function asString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const raw = row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
    if (raw == null) continue;
    return String(raw);
  }
  return '';
}

export async function resolveAccountKey(
  db: SqlDb,
  accountKey: number
): Promise<AccountKeyResult> {
  const result = await db.executeSql.run(`
SELECT FIRST 1
  a.id,
  a.alias,
  a.name
FROM ac_account a
WHERE a.id = ${accountKey}`);

  const row = result.rows[0];
  if (!row || typeof row !== 'object') {
    return {
      ok: false,
      code: 'ACCOUNT_NOT_FOUND',
      message:
        `accountKey ${accountKey} was not found in AC_ACCOUNT. ` +
        'Do not pass an account alias (e.g. 60 or 62) as accountKey — ' +
        'call find_account first and use the returned id.',
    };
  }

  const record = row as Record<string, unknown>;
  const id = asNumber(record, 'id', 'ID');
  if (id == null) {
    return {
      ok: false,
      code: 'ACCOUNT_NOT_FOUND',
      message:
        `accountKey ${accountKey} was not found in AC_ACCOUNT. ` +
        'Do not pass an account alias (e.g. 60 or 62) as accountKey — ' +
        'call find_account first and use the returned id.',
    };
  }

  return {
    ok: true,
    accountKey: id,
    alias: asString(record, 'alias', 'ALIAS'),
    name: asString(record, 'name', 'NAME'),
  };
}
