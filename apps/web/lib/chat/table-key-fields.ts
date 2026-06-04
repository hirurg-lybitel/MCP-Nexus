/** PK/FK field names from RDB$RELATION_CONSTRAINTS (see db-firebird getTableFieldConstraints). */
export interface TableKeyFields {
  primaryKey: string[];
  foreignKey: string[];
}

export function normalizeTableKeyFields(raw: unknown): TableKeyFields | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }

  const record = raw as Record<string, unknown>;
  const primaryKey = Array.isArray(record.primaryKey)
    ? record.primaryKey
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map((v) => v.trim().toUpperCase())
    : [];
  const foreignKey = Array.isArray(record.foreignKey)
    ? record.foreignKey
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map((v) => v.trim().toUpperCase())
    : [];

  if (primaryKey.length === 0 && foreignKey.length === 0) {
    return undefined;
  }

  return { primaryKey, foreignKey };
}

export function isRdbKeyField(
  columnKey: string,
  keyFields: TableKeyFields
): boolean {
  const upper = columnKey.trim().toUpperCase();
  return (
    keyFields.primaryKey.includes(upper) ||
    keyFields.foreignKey.includes(upper)
  );
}
