/**
 * Resolve AC_ENTRY analytics field metadata (AT_RELATION_FIELDS → AT_FIELDS).
 */

type SqlDb = {
  executeSql: {
    run: (sql: string) => Promise<{ rows: unknown[] }>;
  };
};

export type AnalyticsFieldMeta = {
  fieldName: string;
  fieldLabel: string;
  refTable: string | null;
  nameColumn: string | null;
};

function esc(literal: string): string {
  return literal.replace(/'/g, "''");
}

export function isSafeIdent(name: string): boolean {
  return /^[A-Z][A-Z0-9_$]*$/i.test(name);
}

function asString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const raw = row[key] ?? row[key.toUpperCase()] ?? row[key.toLowerCase()];
    if (raw == null) continue;
    return String(raw).trim();
  }
  return '';
}

export async function resolveAnalyticsField(
  db: SqlDb,
  fieldNameRaw: string
): Promise<
  | { ok: true; meta: AnalyticsFieldMeta }
  | { ok: false; code: string; message: string }
> {
  const fieldName = fieldNameRaw.trim().toUpperCase();
  if (!fieldName.startsWith('USR$') || !isSafeIdent(fieldName)) {
    return {
      ok: false,
      code: 'INVALID_FIELD',
      message:
        'fieldName must be a USR$ analytics column on AC_ENTRY (e.g. USR$GS_CUSTOMER)',
    };
  }

  const metaResult = await db.executeSql.run(`
SELECT FIRST 1
  TRIM(arf.fieldname) AS fieldname,
  TRIM(arf.lname) AS lname,
  TRIM(af.reftable) AS reftable,
  TRIM(af.reflistfield) AS reflistfield
FROM at_relation_fields arf
LEFT JOIN at_fields af ON TRIM(af.fieldname) = TRIM(arf.fieldsource)
WHERE TRIM(arf.relationname) = 'AC_ENTRY'
  AND UPPER(TRIM(arf.fieldname)) = '${esc(fieldName)}'`);

  const metaRow = metaResult.rows[0] as Record<string, unknown> | undefined;
  if (!metaRow) {
    return {
      ok: false,
      code: 'FIELD_NOT_FOUND',
      message: `Analytics field ${fieldName} was not found on AC_ENTRY in AT_RELATION_FIELDS`,
    };
  }

  const fieldLabel = asString(metaRow, 'lname', 'LNAME') || fieldName;
  const refTableRaw = asString(metaRow, 'reftable', 'REFTABLE');
  const refTable =
    refTableRaw && isSafeIdent(refTableRaw) ? refTableRaw.toUpperCase() : null;
  let nameColumn: string | null = null;

  const listField = asString(metaRow, 'reflistfield', 'REFLISTFIELD');
  if (listField && isSafeIdent(listField)) {
    nameColumn = listField.toUpperCase();
  } else if (refTable) {
    const nameCols = await db.executeSql.run(`
SELECT FIRST 5 TRIM(rf.rdb$field_name) AS fn
FROM rdb$relation_fields rf
WHERE TRIM(rf.rdb$relation_name) = '${esc(refTable)}'
  AND UPPER(TRIM(rf.rdb$field_name)) IN ('NAME','USR$NAME','CAPTION','NUMBER','ALIAS')
ORDER BY
  CASE UPPER(TRIM(rf.rdb$field_name))
    WHEN 'NAME' THEN 1
    WHEN 'USR$NAME' THEN 2
    WHEN 'CAPTION' THEN 3
    WHEN 'NUMBER' THEN 4
    WHEN 'ALIAS' THEN 5
    ELSE 9
  END`);
    const fn = asString(
      (nameCols.rows[0] as Record<string, unknown> | undefined) ?? {},
      'fn',
      'FN'
    );
    if (fn && isSafeIdent(fn)) nameColumn = fn.toUpperCase();
  }

  return {
    ok: true,
    meta: {
      fieldName,
      fieldLabel,
      refTable,
      nameColumn,
    },
  };
}

export type AccountAnalyticsField = {
  fieldName: string;
  fieldLabel: string;
};

/**
 * Distinct USR$ analytics columns attached to the account (and optional LB/RB
 * subtree) via AC_ACCANALYTICSEXT → AT_RELATION_FIELDS.
 */
export async function listAccountAnalyticsFields(
  db: SqlDb,
  accountKeys: number[]
): Promise<AccountAnalyticsField[]> {
  if (accountKeys.length === 0) return [];
  const result = await db.executeSql.run(`
SELECT DISTINCT
  TRIM(arf.fieldname) AS fieldname,
  TRIM(arf.lname) AS lname
FROM ac_accanalyticsext x
JOIN at_relation_fields arf ON arf.id = x.valuekey
WHERE x.accountkey IN (${accountKeys.join(',')})
  AND UPPER(TRIM(arf.fieldname)) STARTING WITH 'USR$'
ORDER BY 1`);

  const out: AccountAnalyticsField[] = [];
  const seen = new Set<string>();
  for (const row of result.rows) {
    const r = row as Record<string, unknown>;
    const fieldName = asString(r, 'fieldname', 'FIELDNAME').toUpperCase();
    if (!fieldName || !isSafeIdent(fieldName) || seen.has(fieldName)) continue;
    seen.add(fieldName);
    out.push({
      fieldName,
      fieldLabel: asString(r, 'lname', 'LNAME') || fieldName,
    });
  }
  return out;
}

/**
 * Resolve fieldName for get_analytics_balance:
 * - explicit fieldName → validate on AC_ENTRY;
 * - omitted → the single AC_ACCANALYTICSEXT field on the account tree, or error.
 */
export async function resolveAnalyticsFieldForAccounts(
  db: SqlDb,
  accountKeys: number[],
  fieldNameRaw: string | undefined
): Promise<
  | { ok: true; meta: AnalyticsFieldMeta; availableFields: AccountAnalyticsField[] }
  | { ok: false; code: string; message: string; availableFields?: AccountAnalyticsField[] }
> {
  const availableFields = await listAccountAnalyticsFields(db, accountKeys);

  if (fieldNameRaw && fieldNameRaw.trim()) {
    const resolved = await resolveAnalyticsField(db, fieldNameRaw);
    if (!resolved.ok) return resolved;
    return { ok: true, meta: resolved.meta, availableFields };
  }

  if (availableFields.length === 0) {
    return {
      ok: false,
      code: 'NO_ANALYTICS_FIELD',
      message:
        'No USR$ analytics on AC_ACCANALYTICSEXT for this account tree. Pass fieldName explicitly (a USR$ column on AC_ENTRY).',
      availableFields,
    };
  }

  if (availableFields.length > 1) {
    const list = availableFields
      .map((f) => `${f.fieldName} (${f.fieldLabel})`)
      .join(', ');
    return {
      ok: false,
      code: 'AMBIGUOUS_ANALYTICS_FIELD',
      message: `Several analytics fields on this account tree — pass fieldName. Available: ${list}`,
      availableFields,
    };
  }

  const only = availableFields[0]!;
  const resolved = await resolveAnalyticsField(db, only.fieldName);
  if (!resolved.ok) return { ...resolved, availableFields };
  return { ok: true, meta: resolved.meta, availableFields };
}
