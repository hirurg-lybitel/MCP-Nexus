import type { TableColumn } from '@/types';
import { formatExportCell } from './table-export';

export const DEFAULT_PAGE_SIZE = 25;

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  columnKey: string;
  direction: SortDirection;
}

export function filterTableRows(
  rows: Record<string, unknown>[],
  columns: TableColumn[],
  filterText: string
): Record<string, unknown>[] {
  const q = filterText.trim().toLowerCase();
  if (!q) {
    return rows;
  }

  return rows.filter((row) =>
    columns.some((col) =>
      formatExportCell(row[col.key]).toLowerCase().includes(q)
    )
  );
}

function parseSortableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const n = Number(trimmed);
    if (Number.isFinite(n)) {
      return n;
    }
    const date = Date.parse(trimmed);
    if (!Number.isNaN(date)) {
      return date;
    }
  }
  return null;
}

export function compareRowValues(
  a: unknown,
  b: unknown,
  direction: SortDirection
): number {
  const sign = direction === 'asc' ? 1 : -1;

  if (a == null && b == null) {
    return 0;
  }
  if (a == null) {
    return 1 * sign;
  }
  if (b == null) {
    return -1 * sign;
  }

  const numA = parseSortableNumber(a);
  const numB = parseSortableNumber(b);
  if (numA !== null && numB !== null) {
    return (numA - numB) * sign;
  }

  const strA = formatExportCell(a).toLowerCase();
  const strB = formatExportCell(b).toLowerCase();
  return strA.localeCompare(strB, undefined, { numeric: true }) * sign;
}

export function sortTableRows(
  rows: Record<string, unknown>[],
  sort: SortState | null
): Record<string, unknown>[] {
  if (!sort) {
    return rows;
  }

  const { columnKey, direction } = sort;
  return [...rows].sort((rowA, rowB) =>
    compareRowValues(rowA[columnKey], rowB[columnKey], direction)
  );
}

export function paginateRows<T>(
  rows: T[],
  page: number,
  pageSize: number
): { pageRows: T[]; totalPages: number; page: number } {
  if (rows.length === 0) {
    return { pageRows: [], totalPages: 1, page: 1 };
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    pageRows: rows.slice(start, start + pageSize),
    totalPages,
    page: safePage,
  };
}

export function nextSortState(
  current: SortState | null,
  columnKey: string
): SortState | null {
  if (!current || current.columnKey !== columnKey) {
    return { columnKey, direction: 'asc' };
  }
  if (current.direction === 'asc') {
    return { columnKey, direction: 'desc' };
  }
  return null;
}

export function mergeVisibleColumns(
  columns: TableColumn[],
  hiddenColumns: TableColumn[] | undefined,
  showHidden: boolean
): TableColumn[] {
  if (!showHidden || !hiddenColumns?.length) {
    return columns;
  }
  const seen = new Set(columns.map((c) => c.key));
  const merged = [...columns];
  for (const col of hiddenColumns) {
    if (!seen.has(col.key)) {
      merged.push(col);
      seen.add(col.key);
    }
  }
  return merged;
}
