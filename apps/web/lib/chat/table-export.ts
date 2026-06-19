import type { TableColumn, TableDisplayData } from '@/types';

export function formatExportCell(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'object') return JSON.stringify(value);
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
  delimiter: string
): string {
  const header = columns.map((col) => escapeField(col.label)).join(delimiter);
  const body = rows.map((row) =>
    columns
      .map((col) => escapeField(formatExportCell(row[col.key])))
      .join(delimiter)
  );
  return [header, ...body].join('\r\n');
}

export function serializeTableToCsv(data: TableDisplayData): string {
  return serializeTableRows(data.columns, data.rows, escapeCsvField, ',');
}

export function serializeTableToTsv(data: TableDisplayData): string {
  return serializeTableRows(data.columns, data.rows, escapeTsvField, '\t');
}

export function buildExportFilename(title: string | undefined): string {
  const date = new Date().toISOString().slice(0, 10);
  const base =
    title?.trim().replace(/[^\p{L}\p{N}\-_]+/gu, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') ||
    'query_result';
  return `${base}_${date}.csv`;
}

export function downloadTableCsv(data: TableDisplayData): void {
  const csv = serializeTableToCsv(data);
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildExportFilename(data.title);
  link.click();
  URL.revokeObjectURL(url);
}

export async function copyTableTsv(data: TableDisplayData): Promise<void> {
  await navigator.clipboard.writeText(serializeTableToTsv(data));
}
