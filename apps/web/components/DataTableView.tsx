'use client';

import { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import type { TableDisplayData } from '@/types';
import { useTranslations } from '@/lib/i18n/use-translations';
import { copyTableTsv, downloadTableCsv, formatExportCell } from '@/lib/chat/table-export';

interface DataTableViewProps {
  data: TableDisplayData;
}

/** At or below this count, columns share the full container width. */
const STRETCH_COLUMNS_THRESHOLD = 8;

export default function DataTableView({ data }: DataTableViewProps) {
  const { t } = useTranslations();
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const { title, columns, rows, meta } = data;
  const hiddenColumnCount = meta?.hiddenColumnCount ?? 0;
  const isPartialExport = Boolean(meta?.truncated) || hiddenColumnCount > 0;
  const stretchColumns =
    columns.length > 0 && columns.length <= STRETCH_COLUMNS_THRESHOLD;

  async function handleCopy() {
    try {
      await copyTableTsv(data);
      setCopyState('success');
      window.setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 2000);
    }
  }

  const copyLabel =
    copyState === 'success'
      ? t('table.copySuccess')
      : copyState === 'error'
        ? t('table.copyFailed')
        : isPartialExport
          ? t('table.copyPartial')
          : t('table.copy');

  const downloadLabel = isPartialExport
    ? t('table.downloadCsvPartial')
    : t('table.downloadCsv');

  if (columns.length === 0 && rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">{t('table.noRows')}</p>
    );
  }

  return (
    <div className="space-y-2 w-full min-w-0 max-w-full">
      <div className="flex flex-wrap items-start justify-between gap-2">
        {title && (
          <h4 className="text-sm font-semibold text-emerald-400">{title}</h4>
        )}
        <div className="flex flex-col items-end gap-1.5 text-xs text-gray-400 tabular-nums">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {meta?.rowCount != null && (
              <span>
                {meta.rowCount === 1
                  ? t('table.rowCountOne', { count: meta.rowCount })
                  : t('table.rowCountMany', { count: meta.rowCount })}
                {meta.truncated ? ` ${t('table.truncated')}` : ''}
              </span>
            )}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => downloadTableCsv(data)}
                title={downloadLabel}
                aria-label={downloadLabel}
                className="inline-flex items-center justify-center rounded-md border border-gray-600/80 bg-gray-800/60 p-1.5 text-gray-200 hover:bg-gray-700/80 transition-colors"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => void handleCopy()}
                title={copyLabel}
                aria-label={copyLabel}
                className="inline-flex items-center justify-center rounded-md border border-gray-600/80 bg-gray-800/60 p-1.5 text-gray-200 hover:bg-gray-700/80 transition-colors"
              >
                {copyState === 'success' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </div>
          </div>
          {hiddenColumnCount > 0 && (
            <span className="text-gray-500 max-w-[14rem] text-right">
              {hiddenColumnCount === 1
                ? t('table.hiddenColumnsOne', { count: hiddenColumnCount })
                : t('table.hiddenColumnsMany', { count: hiddenColumnCount })}
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
                    {formatExportCell(row[col.key])}
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
