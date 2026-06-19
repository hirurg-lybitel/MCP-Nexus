import type { TableColumn } from '@/types';

export type ChartSpec =
  | { chartable: false }
  | {
      chartable: true;
      labelKey?: string;
      valueKey: string;
      chartType: 'bar';
      useRowIndex?: boolean;
    };

const MIN_ROWS = 2;
const MAX_ROWS = 50;
const MIN_UNIQUE_LABELS = 2;
const MAX_UNIQUE_LABELS = 25;
const NUMERIC_RATIO_THRESHOLD = 0.8;

function isNumericValue(value: unknown): boolean {
  if (value == null || value === '') {
    return false;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }
    const parsed = Number(trimmed.replace(/,/g, ''));
    return Number.isFinite(parsed);
  }
  return false;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return Number(value.trim().replace(/,/g, ''));
  }
  return NaN;
}

function numericRatio(
  rows: Record<string, unknown>[],
  key: string
): number {
  const values = rows
    .map((row) => row[key])
    .filter((value) => value != null && value !== '');
  if (values.length === 0) {
    return 0;
  }
  const numericCount = values.filter(isNumericValue).length;
  return numericCount / values.length;
}

function uniqueLabelCount(
  rows: Record<string, unknown>[],
  key: string
): number {
  const seen = new Set<string>();
  for (const row of rows) {
    const raw = row[key];
    if (raw == null || raw === '') {
      continue;
    }
    seen.add(String(raw));
  }
  return seen.size;
}

export function detectChartSpec(
  columns: TableColumn[],
  rows: Record<string, unknown>[]
): ChartSpec {
  if (rows.length < MIN_ROWS || rows.length > MAX_ROWS || columns.length === 0) {
    return { chartable: false };
  }

  const numericKeys = columns
    .map((col) => col.key)
    .filter((key) => numericRatio(rows, key) >= NUMERIC_RATIO_THRESHOLD);

  if (numericKeys.length === 0) {
    return { chartable: false };
  }

  const valueKey = numericKeys[0]!;

  const labelCandidates = columns
    .map((col) => col.key)
    .filter((key) => key !== valueKey && numericRatio(rows, key) < NUMERIC_RATIO_THRESHOLD)
    .map((key) => ({ key, unique: uniqueLabelCount(rows, key) }))
    .filter(
      ({ unique }) =>
        unique >= MIN_UNIQUE_LABELS && unique <= MAX_UNIQUE_LABELS
    )
    .sort((a, b) => a.unique - b.unique);

  if (labelCandidates.length > 0) {
    return {
      chartable: true,
      labelKey: labelCandidates[0]!.key,
      valueKey,
      chartType: 'bar',
    };
  }

  return {
    chartable: true,
    valueKey,
    chartType: 'bar',
    useRowIndex: true,
  };
}

export { toNumber as chartValueToNumber };
