import type { TableColumnMeta } from '@/types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function normalizeColumnMetaEntry(
  raw: unknown
): TableColumnMeta | undefined {
  const record = asRecord(raw);
  if (!record) {
    return undefined;
  }

  const meta: TableColumnMeta = {};
  if (record.fieldType != null && String(record.fieldType).trim()) {
    meta.fieldType = String(record.fieldType);
  }
  if (typeof record.fieldLength === 'number') {
    meta.fieldLength = record.fieldLength;
  }
  if (record.refTable != null && String(record.refTable).trim()) {
    meta.refTable = String(record.refTable);
  }
  if (record.refListField != null && String(record.refListField).trim()) {
    meta.refListField = String(record.refListField);
  }
  const constraint = record.constraintType;
  if (constraint === 'PRIMARY KEY' || constraint === 'FOREIGN KEY') {
    meta.constraintType = constraint;
  }

  return Object.keys(meta).length > 0 ? meta : undefined;
}

export function normalizeColumnMetaMap(
  raw: unknown
): Record<string, TableColumnMeta> | undefined {
  const record = asRecord(raw);
  if (!record) {
    return undefined;
  }

  const map: Record<string, TableColumnMeta> = {};
  for (const [key, value] of Object.entries(record)) {
    const meta = normalizeColumnMetaEntry(value);
    if (meta) {
      map[key] = meta;
      map[key.trim().toUpperCase()] = meta;
    }
  }

  return Object.keys(map).length > 0 ? map : undefined;
}

export function columnMetaForKey(
  map: Record<string, TableColumnMeta> | undefined,
  columnKey: string
): TableColumnMeta | undefined {
  if (!map) {
    return undefined;
  }
  return map[columnKey] ?? map[columnKey.trim().toUpperCase()];
}
