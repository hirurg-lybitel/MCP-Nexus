import type { Locale } from '@/lib/i18n/types';
import { localeToBcp47 } from '@/lib/i18n/types';
import type { TableColumnMeta } from '@/types';

export type CellKind =
  | 'null'
  | 'boolean'
  | 'integer'
  | 'decimal'
  | 'date'
  | 'datetime'
  | 'time'
  | 'text'
  | 'json';

const INTEGER_FIELD_TYPES = new Set([
  'SMALLINT',
  'INTEGER',
  'BIGINT',
  'LONG',
  'INT64',
]);

const DECIMAL_FIELD_TYPES = new Set([
  'FLOAT',
  'DOUBLE',
  'NUMERIC',
  'DECIMAL',
]);

const DATE_FIELD_TYPES = new Set(['DATE']);
const TIME_FIELD_TYPES = new Set(['TIME']);
const DATETIME_FIELD_TYPES = new Set(['TIMESTAMP', 'TIMESTAMP WITH TIME ZONE']);

const DATE_NAME_RE = /DATE|DATETIME|CREATED|UPDATED|MODIFIED|BIRTH/i;
const TIME_NAME_RE = /TIME$/i;
const DECIMAL_NAME_RE = /PRICE|AMOUNT|SUM|QTY|QUANTITY|COST|RATE|BALANCE|TOTAL/i;

const TEXT_FIELD_TYPES = new Set([
  'CHAR',
  'VARCHAR',
  'TEXT',
  'CSTRING',
  'BLOB',
]);

export function cellKindFromFieldType(fieldType: string | null | undefined): CellKind | null {
  if (!fieldType?.trim()) {
    return null;
  }
  const upper = fieldType.trim().toUpperCase();
  if (TEXT_FIELD_TYPES.has(upper)) {
    return 'text';
  }
  if (INTEGER_FIELD_TYPES.has(upper)) {
    return 'integer';
  }
  if (DECIMAL_FIELD_TYPES.has(upper)) {
    return 'decimal';
  }
  if (DATE_FIELD_TYPES.has(upper)) {
    return 'date';
  }
  if (TIME_FIELD_TYPES.has(upper)) {
    return 'time';
  }
  if (DATETIME_FIELD_TYPES.has(upper) || upper.startsWith('TIMESTAMP')) {
    return 'datetime';
  }
  return null;
}

function isNullValue(value: unknown): boolean {
  return value == null || value === '';
}

function inferFromValue(value: unknown): CellKind | null {
  if (isNullValue(value)) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'decimal';
  }
  if (typeof value === 'object') {
    return 'json';
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'null';
    }
    if (trimmed === 'true' || trimmed === 'false') {
      return 'boolean';
    }
    if (/^-?\d+$/.test(trimmed)) {
      return 'integer';
    }
    if (/^-?\d+([.,]\d+)?$/.test(trimmed)) {
      return 'decimal';
    }
    if (/^\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}/.test(trimmed)) {
      return 'datetime';
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return 'date';
    }
    if (/^\d{2}:\d{2}(:\d{2})?/.test(trimmed)) {
      return 'time';
    }
  }
  return null;
}

function inferFromColumnKey(columnKey: string): CellKind | null {
  const upper = columnKey.trim().toUpperCase();
  if (TIME_NAME_RE.test(upper) && !DATE_NAME_RE.test(upper)) {
    return 'time';
  }
  if (DATE_NAME_RE.test(upper)) {
    return upper.includes('TIME') && !upper.endsWith('TIME')
      ? 'datetime'
      : 'date';
  }
  if (DECIMAL_NAME_RE.test(upper)) {
    return 'decimal';
  }
  return null;
}

export function resolveCellKind(
  value: unknown,
  columnKey: string,
  columnMeta?: TableColumnMeta
): CellKind {
  if (isNullValue(value)) {
    return 'null';
  }

  const fromSchema = cellKindFromFieldType(columnMeta?.fieldType);
  if (fromSchema) {
    return fromSchema;
  }

  const fromValue = inferFromValue(value);
  if (fromValue === 'json') {
    return 'json';
  }
  if (fromValue && fromValue !== 'text') {
    return fromValue;
  }

  const fromKey = inferFromColumnKey(columnKey);
  if (fromKey) {
    return fromKey;
  }

  return 'text';
}

function labelHasDateCue(label: string): boolean {
  return /дата|\bdate\b/i.test(label);
}

function labelHasTimeCue(label: string): boolean {
  return /время|\btime\b/i.test(label);
}

function keySuggestsDateOnly(columnKey: string): boolean {
  const upper = columnKey.trim().toUpperCase();
  return (
    /_DATE$/.test(upper) ||
    /^DATE_/.test(upper) ||
    /^DOC_DATE/.test(upper)
  );
}

function keySuggestsTimeOnly(columnKey: string): boolean {
  const upper = columnKey.trim().toUpperCase();
  return /_TIME$/.test(upper) || /^TIME_/.test(upper);
}

/** Narrows datetime/timestamp display to date-only or time-only from label/key. */
export function inferDateTimeDisplayKind(
  columnKey: string,
  columnLabel?: string
): 'date' | 'time' | null {
  const label = columnLabel?.trim() ?? '';
  const hasDate = label ? labelHasDateCue(label) : false;
  const hasTime = label ? labelHasTimeCue(label) : false;

  if (label && /datetime|date\s*\/\s*time|дата\s*и\s*время/i.test(label)) {
    return null;
  }

  if (hasTime && hasDate) {
    return null;
  }

  if (hasTime && !hasDate) {
    return 'time';
  }

  if (hasDate && !hasTime) {
    return 'date';
  }

  if (keySuggestsTimeOnly(columnKey) && !keySuggestsDateOnly(columnKey)) {
    return 'time';
  }

  if (keySuggestsDateOnly(columnKey) && !keySuggestsTimeOnly(columnKey)) {
    return 'date';
  }

  return null;
}

export function resolveDisplayKind(
  value: unknown,
  columnKey: string,
  columnMeta?: TableColumnMeta,
  columnLabel?: string
): CellKind {
  const baseKind = resolveCellKind(value, columnKey, columnMeta);
  const schemaKind = cellKindFromFieldType(columnMeta?.fieldType);

  const canNarrow =
    baseKind === 'datetime' ||
    schemaKind === 'datetime' ||
    (baseKind === 'date' &&
      inferDateTimeDisplayKind(columnKey, columnLabel) === 'time');

  if (!canNarrow) {
    return baseKind;
  }

  const displayHint = inferDateTimeDisplayKind(columnKey, columnLabel);
  if (displayHint) {
    return displayHint;
  }

  return baseKind;
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value.trim());
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'true' || lower === 'yes' || lower === '1') {
      return true;
    }
    if (lower === 'false' || lower === 'no' || lower === '0') {
      return false;
    }
  }
  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }
  return null;
}

export function formatCellPlainText(
  value: unknown,
  kind: CellKind,
  locale: Locale = 'en'
): string {
  const bcp47 = localeToBcp47(locale);

  if (kind === 'null') {
    return '—';
  }

  if (kind === 'boolean') {
    const bool = parseBoolean(value);
    return bool === true ? 'yes' : bool === false ? 'no' : String(value ?? '');
  }

  if (kind === 'integer' || kind === 'decimal') {
    const num = parseNumeric(value);
    if (num == null) {
      return String(value ?? '');
    }
    return new Intl.NumberFormat(bcp47, {
      maximumFractionDigits: kind === 'integer' ? 0 : 6,
    }).format(num);
  }

  if (kind === 'date') {
    const date = parseDate(value);
    if (!date) {
      return String(value ?? '');
    }
    return new Intl.DateTimeFormat(bcp47, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  if (kind === 'time') {
    let date = parseDate(value);
    if (!date && typeof value === 'string') {
      date = parseDate(`1970-01-01T${value.trim()}`);
    }
    if (!date) {
      return String(value ?? '');
    }
    return new Intl.DateTimeFormat(bcp47, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  }

  if (kind === 'datetime') {
    const date = parseDate(value);
    if (!date) {
      return String(value ?? '');
    }
    return new Intl.DateTimeFormat(bcp47, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  if (kind === 'json') {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return String(value ?? '');
  }

  return String(value ?? '');
}

export const LONG_TEXT_THRESHOLD = 120;

export function isLongText(value: unknown, kind: CellKind): boolean {
  if (kind !== 'text') {
    return false;
  }
  const text = String(value ?? '');
  return text.length > LONG_TEXT_THRESHOLD;
}

export function isForeignKeyColumn(
  columnKey: string,
  columnMeta?: TableColumnMeta,
  keyFields?: { primaryKey: string[]; foreignKey: string[] }
): boolean {
  if (columnMeta?.refTable?.trim()) {
    return true;
  }
  if (columnMeta?.constraintType === 'FOREIGN KEY') {
    return true;
  }
  const upper = columnKey.trim().toUpperCase();
  return keyFields?.foreignKey.includes(upper) ?? false;
}

export function foreignKeyRefTable(
  columnMeta?: TableColumnMeta
): string | undefined {
  const ref = columnMeta?.refTable?.trim();
  return ref || undefined;
}
