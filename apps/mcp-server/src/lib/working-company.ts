/**
 * Resolve the working organization for accounting tools.
 *
 * - Explicit companyKey must exist in GD_OURCOMPANY (never invent 1/0).
 * - Omitted companyKey: if exactly one working org has an active chart, use it
 *   (pilot / A14+TZ collapse). If several — AMBIGUOUS_COMPANY (name via find_counterparty).
 */

type SqlDb = {
  executeSql: {
    run: (sql: string) => Promise<{ rows: unknown[] }>;
  };
};

export type WorkingCompanyRef = {
  companyKey: number;
  name: string;
};

export type WorkingCompanyOk = {
  ok: true;
  companyKey: number;
  companyName: string;
  companyScope: 'explicit' | 'default_single_working';
};

export type WorkingCompanyErr = {
  ok: false;
  code: 'COMPANY_NOT_FOUND' | 'NO_WORKING_COMPANY' | 'AMBIGUOUS_COMPANY';
  message: string;
  companies?: WorkingCompanyRef[];
};

export type WorkingCompanyResult = WorkingCompanyOk | WorkingCompanyErr;

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

function mapCompanyRows(rows: unknown[]): WorkingCompanyRef[] {
  const out: WorkingCompanyRef[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const companyKey = asNumber(record, 'companykey', 'COMPANYKEY');
    if (companyKey == null) continue;
    out.push({
      companyKey,
      name: asString(record, 'name', 'NAME'),
    });
  }
  return out;
}

/** Working organizations that have an active chart (AC_COMPANYACCOUNT.ISACTIVE = 1). */
export async function listWorkingCompanies(db: SqlDb): Promise<WorkingCompanyRef[]> {
  const result = await db.executeSql.run(`
SELECT DISTINCT
  o.companykey,
  c.name
FROM gd_ourcompany o
JOIN gd_contact c ON c.id = o.companykey
WHERE EXISTS (
  SELECT 1
  FROM ac_companyaccount ca
  WHERE ca.companykey = o.companykey
    AND ca.isactive = 1
)
ORDER BY o.companykey`);
  return mapCompanyRows(result.rows);
}

export async function resolveWorkingCompany(
  db: SqlDb,
  companyKey?: number
): Promise<WorkingCompanyResult> {
  if (companyKey != null) {
    const result = await db.executeSql.run(`
SELECT FIRST 1
  o.companykey,
  c.name
FROM gd_ourcompany o
JOIN gd_contact c ON c.id = o.companykey
WHERE o.companykey = ${companyKey}`);
    const found = mapCompanyRows(result.rows)[0];
    if (!found) {
      return {
        ok: false,
        code: 'COMPANY_NOT_FOUND',
        message:
          `companyKey ${companyKey} is not a working organization (GD_OURCOMPANY). ` +
          'Do not invent ids (never use 1 or 0). ' +
          'Use find_counterparty when the user named an organization, ' +
          'or omit companyKey to use the only working organization with an active chart.',
      };
    }
    return {
      ok: true,
      companyKey: found.companyKey,
      companyName: found.name,
      companyScope: 'explicit',
    };
  }

  const companies = await listWorkingCompanies(db);
  if (companies.length === 0) {
    return {
      ok: false,
      code: 'NO_WORKING_COMPANY',
      message:
        'No working organization with an active chart (GD_OURCOMPANY + AC_COMPANYACCOUNT.ISACTIVE = 1).',
    };
  }
  if (companies.length === 1) {
    const only = companies[0]!;
    return {
      ok: true,
      companyKey: only.companyKey,
      companyName: only.name,
      companyScope: 'default_single_working',
    };
  }

  return {
    ok: false,
    code: 'AMBIGUOUS_COMPANY',
    message:
      `Several working organizations (${companies.length}). ` +
      'Name the organization and call find_counterparty, or pass companyKey. ' +
      'Do not invent companyKey.',
    companies,
  };
}
