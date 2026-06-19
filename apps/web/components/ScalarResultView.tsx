'use client';

import { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import type { TableDisplayData } from '@/types';
import TableQueryChip from './TableQueryChip';
import { useTranslations } from '@/lib/i18n/use-translations';
import {
  copyTableTsv,
  downloadTableCsv,
  formatExportCell,
} from '@/lib/chat/table-export';

interface ScalarResultViewProps {
  data: TableDisplayData;
}

export default function ScalarResultView({ data }: ScalarResultViewProps) {
  const { t } = useTranslations();
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>(
    'idle'
  );

  const { title, columns, rows, meta, sql, params } = data;
  const row = rows[0] ?? {};
  const displayTitle = title?.trim() || t('table.scalarTitle');

  const handleCopy = async () => {
    try {
      await copyTableTsv(data);
      setCopyState('success');
    } catch {
      setCopyState('error');
    }
    window.setTimeout(() => setCopyState('idle'), 2000);
  };

  if (columns.length === 0 && rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">{t('table.noRows')}</p>
    );
  }

  return (
    <div className="space-y-2 w-full min-w-0 max-w-full">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-emerald-400">{displayTitle}</h4>
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
                title={t('table.downloadCsv')}
                aria-label={t('table.downloadCsv')}
                className="inline-flex items-center justify-center rounded-md border border-gray-600/80 bg-gray-800/60 p-1.5 text-gray-200 hover:bg-gray-700/80 transition-colors"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => void handleCopy()}
                title={t('table.copy')}
                aria-label={t('table.copy')}
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
        </div>
      </div>

      <TableQueryChip sql={sql} params={params} />

      <dl className="rounded-lg border border-gray-600/80 bg-gray-900/60 divide-y divide-gray-700/50">
        {columns.map((col) => (
          <div
            key={col.key}
            className="grid grid-cols-[minmax(6rem,35%)_1fr] gap-x-4 gap-y-0.5 px-3 py-2.5 text-sm"
          >
            <dt className="text-gray-400 font-medium break-words">{col.label}</dt>
            <dd className="text-gray-100 break-words min-w-0">
              {formatExportCell(row[col.key])}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
