import type { TableColumn } from '@/types';

export const UI_ROW_NUMBER_KEY = '__uiRowNum';

const EXPLICIT_ROW_NUMBER_KEYS = new Set([
  'ROW_NUM',
  'ROW_NUMBER',
  'ROWNO',
  'ROW_NO',
  'RN',
  'RNUM',
  'INDEX',
  'IDX',
  'N',
  'NO',
  'NUM',
  '№',
]);

function isExplicitRowNumberLabel(label: string): boolean {
  const trimmed = label.trim();
  if (trimmed === '№' || trimmed === '#') {
    return true;
  }
  return /номер\s*строк/i.test(trimmed);
}

export function hasExplicitRowNumberColumn(columns: TableColumn[]): boolean {
  return columns.some((col) => {
    const key = col.key.trim().toUpperCase();
    if (EXPLICIT_ROW_NUMBER_KEYS.has(key)) {
      return true;
    }
    return isExplicitRowNumberLabel(col.label);
  });
}

export function shouldShowUiRowNumberColumn(
  rowCount: number,
  columns: TableColumn[]
): boolean {
  return rowCount > 1 && !hasExplicitRowNumberColumn(columns);
}

export function createUiRowNumberColumn(label: string): TableColumn {
  return {
    key: UI_ROW_NUMBER_KEY,
    label,
  };
}

export function withUiRowNumberColumn(
  columns: TableColumn[],
  enabled: boolean,
  rowNumberLabel: string
): TableColumn[] {
  if (!enabled || hasExplicitRowNumberColumn(columns)) {
    return columns;
  }
  return [createUiRowNumberColumn(rowNumberLabel), ...columns];
}

export function isUiRowNumberColumn(columnKey: string): boolean {
  return columnKey === UI_ROW_NUMBER_KEY;
}
