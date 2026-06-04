'use client';

import type { TableDisplayData } from '@/types';

function formatCell(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

interface DataTableViewProps {
  data: TableDisplayData;
}

/** At or below this count, columns share the full container width. */
const STRETCH_COLUMNS_THRESHOLD = 8;

export default function DataTableView({ data }: DataTableViewProps) {
  const { title, columns, rows, meta } = data;
  const hiddenColumnCount = meta?.hiddenColumnCount ?? 0;
  const stretchColumns =
    columns.length > 0 && columns.length <= STRETCH_COLUMNS_THRESHOLD;

  if (columns.length === 0 && rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">No rows returned.</p>
    );
  }

  return (
    <div className="space-y-2 w-full min-w-0 max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title && (
          <h4 className="text-sm font-semibold text-emerald-400">{title}</h4>
        )}
        <div className="flex flex-col items-end gap-0.5 text-xs text-gray-400 tabular-nums">
          {meta?.rowCount != null && (
            <span>
              {meta.rowCount} row{meta.rowCount === 1 ? '' : 's'}
              {meta.truncated ? ' (truncated)' : ''}
            </span>
          )}
          {hiddenColumnCount > 0 && (
            <span className="text-gray-500 max-w-[14rem] text-right">
              {hiddenColumnCount} more column
              {hiddenColumnCount === 1 ? '' : 's'} hidden — ask in chat to show
              them
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto max-w-full min-w-0 rounded-lg border border-gray-600/80 shadow-inner bg-gray-900/60">
        <table
          className={
            stretchColumns
              ? 'w-full table-fixed text-left text-sm border-collapse'
              : 'min-w-max text-left text-sm border-collapse'
          }
        >
          <thead>
            <tr className="bg-gray-700/80 border-b border-gray-600">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={
                    stretchColumns
                      ? 'px-3 py-2.5 font-semibold text-gray-200 break-words'
                      : 'px-3 py-2.5 font-semibold text-gray-200 whitespace-nowrap sticky top-0'
                  }
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={
                  rowIndex % 2 === 0
                    ? 'bg-gray-800/40 hover:bg-gray-700/50'
                    : 'bg-gray-800/20 hover:bg-gray-700/50'
                }
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={
                      stretchColumns
                        ? 'px-3 py-2 text-gray-100 border-t border-gray-700/50 align-top whitespace-normal break-words'
                        : 'px-3 py-2 text-gray-100 border-t border-gray-700/50 align-top whitespace-normal break-words max-w-md'
                    }
                  >
                    {formatCell(row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
