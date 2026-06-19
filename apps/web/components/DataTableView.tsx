'use client';

import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
} from 'lucide-react';
import type { TableColumn, TableDisplayData } from '@/types';
import { useTranslations } from '@/lib/i18n/use-translations';
import {
  copyTableTsv,
  downloadTableCsv,
  formatExportCell,
} from '@/lib/chat/table-export';
import {
  DEFAULT_PAGE_SIZE,
  filterTableRows,
  mergeVisibleColumns,
  nextSortState,
  paginateRows,
  sortTableRows,
  type SortState,
} from '@/lib/chat/table-view-state';

interface DataTableViewProps {
  data: TableDisplayData;
}

/** At or below this count, columns share the full container width. */
const STRETCH_COLUMNS_THRESHOLD = 8;

export default function DataTableView({ data }: DataTableViewProps) {
  const { t } = useTranslations();
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>(
    'idle'
  );
  const [filterText, setFilterText] = useState('');
  const [sort, setSort] = useState<SortState | null>(null);
  const [page, setPage] = useState(1);
  const [showHiddenColumns, setShowHiddenColumns] = useState(false);

  const { title, columns, hiddenColumns, rows, meta } = data;
  const hiddenColumnCount =
    hiddenColumns?.length ?? meta?.hiddenColumnCount ?? 0;

  const visibleColumns = useMemo(
    () => mergeVisibleColumns(columns, hiddenColumns, showHiddenColumns),
    [columns, hiddenColumns, showHiddenColumns]
  );

  const processedRows = useMemo(() => {
    const filtered = filterTableRows(rows, visibleColumns, filterText);
    return sortTableRows(filtered, sort);
  }, [rows, visibleColumns, filterText, sort]);

  const { pageRows, totalPages, page: safePage } = useMemo(
    () => paginateRows(processedRows, page, DEFAULT_PAGE_SIZE),
    [processedRows, page]
  );

  const exportData = useMemo(
    (): TableDisplayData => ({
      ...data,
      columns: visibleColumns,
      rows: processedRows,
    }),
    [data, visibleColumns, processedRows]
  );

  const isPartialExport =
    Boolean(meta?.truncated) ||
    (!showHiddenColumns && hiddenColumnCount > 0);
  const stretchColumns =
    visibleColumns.length > 0 &&
    visibleColumns.length <= STRETCH_COLUMNS_THRESHOLD;

  const rangeStart =
    processedRows.length === 0 ? 0 : (safePage - 1) * DEFAULT_PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * DEFAULT_PAGE_SIZE, processedRows.length);

  async function handleCopy() {
    try {
      await copyTableTsv(exportData);
      setCopyState('success');
      window.setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 2000);
    }
  }

  function handleSort(columnKey: string) {
    setSort((current) => nextSortState(current, columnKey));
    setPage(1);
  }

  function handleFilterChange(value: string) {
    setFilterText(value);
    setPage(1);
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
                onClick={() => downloadTableCsv(exportData)}
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
            <button
              type="button"
              onClick={() => setShowHiddenColumns((v) => !v)}
              className="text-emerald-400/90 hover:text-emerald-300 text-right max-w-[16rem] underline-offset-2 hover:underline"
            >
              {showHiddenColumns
                ? t('table.hideHiddenColumns')
                : hiddenColumnCount === 1
                  ? t('table.showHiddenColumnsOne', {
                    count: hiddenColumnCount,
                  })
                  : t('table.showHiddenColumnsMany', {
                    count: hiddenColumnCount,
                  })}
            </button>
          )}
        </div>
      </div>

      <input
        type="search"
        value={filterText}
        onChange={(e) => handleFilterChange(e.target.value)}
        placeholder={t('table.filterPlaceholder')}
        className="w-full rounded-md border border-gray-600/80 bg-gray-900/70 px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-500"
      />

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
              {visibleColumns.map((col) => (
                <SortableHeader
                  key={col.key}
                  col={col}
                  sort={sort}
                  onSort={handleSort}
                  stretch={stretchColumns}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(visibleColumns.length, 1)}
                  className="px-3 py-4 text-center text-sm text-gray-500 italic"
                >
                  {t('table.noFilterMatch')}
                </td>
              </tr>
            ) : (
              pageRows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={
                    rowIndex % 2 === 0
                      ? 'bg-gray-800/40 hover:bg-gray-700/50'
                      : 'bg-gray-800/20 hover:bg-gray-700/50'
                  }
                >
                  {visibleColumns.map((col) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {processedRows.length > DEFAULT_PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
          <span>
            {t('table.paginationRange', {
              start: rangeStart,
              end: rangeEnd,
              total: processedRows.length,
            })}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label={t('table.paginationPrev')}
              className="inline-flex items-center justify-center rounded border border-gray-600/80 bg-gray-800/60 p-1 disabled:opacity-40 hover:bg-gray-700/80"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 tabular-nums">
              {t('table.paginationPage', {
                page: safePage,
                totalPages,
              })}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label={t('table.paginationNext')}
              className="inline-flex items-center justify-center rounded border border-gray-600/80 bg-gray-800/60 p-1 disabled:opacity-40 hover:bg-gray-700/80"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableHeader({
  col,
  sort,
  onSort,
  stretch,
}: {
  col: TableColumn;
  sort: SortState | null;
  onSort: (key: string) => void;
  stretch: boolean;
}) {
  const active = sort?.columnKey === col.key;
  const direction = active ? sort?.direction : null;

  return (
    <th
      className={
        stretch
          ? 'px-3 py-2.5 font-semibold text-gray-200 break-words'
          : 'px-3 py-2.5 font-semibold text-gray-200 whitespace-nowrap sticky top-0'
      }
    >
      <button
        type="button"
        onClick={() => onSort(col.key)}
        className="inline-flex items-center gap-1 hover:text-white transition-colors max-w-full text-left"
      >
        <span className="truncate">{col.label}</span>
        {direction === 'asc' ? (
          <ArrowUp className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
        ) : direction === 'desc' ? (
          <ArrowDown className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
        ) : (
          <ArrowUpDown className="h-3 w-3 shrink-0 opacity-40" aria-hidden />
        )}
      </button>
    </th>
  );
}
