import type { Locale } from '@/lib/i18n/types';
import type { TableColumn, TableDisplayData } from '@/types';
import {
  formatCellPlainText,
  resolveDisplayKind,
} from './cell-format';
import { isUiRowNumberColumn } from './table-row-number';

export function formatExportCell(
  value: unknown,
  columnKey?: string,
  columnMeta?: import('@/types').TableColumnMeta,
  locale: Locale = 'en',
  columnLabel?: string
): string {
  if (columnKey && isUiRowNumberColumn(columnKey)) {
    return String(value ?? '');
  }

  if (columnKey) {
    const kind = resolveDisplayKind(
      value,
      columnKey,
      columnMeta,
      columnLabel
    );
    return formatCellPlainText(value, kind, locale);
  }

  if (value == null || value === '') {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeTsvField(value: string): string {
  return value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
}

function serializeTableRows(
  columns: TableColumn[],
  rows: Record<string, unknown>[],
  escapeField: (value: string) => string,
  delimiter: string,
  locale: Locale = 'en'
): string {
  const header = columns.map((col) => escapeField(col.label)).join(delimiter);
  const body = rows.map((row, rowIndex) =>
    columns
      .map((col) => {
        const cellValue = isUiRowNumberColumn(col.key)
          ? rowIndex + 1
          : row[col.key];
        return escapeField(
          formatExportCell(
            cellValue,
            col.key,
            col.meta,
            locale,
            col.label
          )
        );
      })
      .join(delimiter)
  );
  return [header, ...body].join('\r\n');
}

export function serializeTableToCsv(
  data: TableDisplayData,
  locale: Locale = 'en'
): string {
  return serializeTableRows(
    data.columns,
    data.rows,
    escapeCsvField,
    ',',
    locale
  );
}

export function serializeTableToTsv(
  data: TableDisplayData,
  locale: Locale = 'en'
): string {
  return serializeTableRows(
    data.columns,
    data.rows,
    escapeTsvField,
    '\t',
    locale
  );
}

export function buildExportFilename(title: string | undefined): string {
  const date = new Date().toISOString().slice(0, 10);
  const base =
    title?.trim().replace(/[^\p{L}\p{N}\-_]+/gu, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') ||
    'query_result';
  return `${base}_${date}.csv`;
}

export function downloadTableCsv(
  data: TableDisplayData,
  locale: Locale = 'en'
): void {
  const csv = serializeTableToCsv(data, locale);
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildExportFilename(data.title);
  link.click();
  URL.revokeObjectURL(url);
}

export async function copyTableTsv(
  data: TableDisplayData,
  locale: Locale = 'en'
): Promise<void> {
  await navigator.clipboard.writeText(serializeTableToTsv(data, locale));
}
