import type { TableDisplayData } from '@/types';

export type ResultViewMode = 'table' | 'scalar';

const SCALAR_MAX_COLUMNS = 4;

export function detectResultViewMode(data: TableDisplayData): ResultViewMode {
  if (data.meta?.truncated) {
    return 'table';
  }

  const rowCount = data.rows.length;
  if (rowCount !== 1) {
    return 'table';
  }

  const visibleColumnCount = data.columns.length;
  if (visibleColumnCount === 0 || visibleColumnCount > SCALAR_MAX_COLUMNS) {
    return 'table';
  }

  return 'scalar';
}
