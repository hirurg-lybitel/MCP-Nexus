'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Maximize2,
  Minimize2,
  Pin,
  PinOff,
} from 'lucide-react';
import TableQueryChip from './TableQueryChip';
import TableChartView from './TableChartView';
import TableCellValue from './TableCellValue';
import TableResultOverlay from './TableResultOverlay';
import { detectChartSpec } from '@/lib/chat/table-chart-detect';
import type { TableColumn, TableDisplayData } from '@/types';
import { useTranslations } from '@/lib/i18n/use-translations';
import { useLocaleStore } from '@/stores/useLocaleStore';
import { usePinnedTableStore } from '@/stores/usePinnedTableStore';
import {
  copyTableTsv,
  downloadTableCsv,
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
import {
  isUiRowNumberColumn,
  shouldShowUiRowNumberColumn,
  withUiRowNumberColumn,
} from '@/lib/chat/table-row-number';

interface DataTableViewProps {
  data: TableDisplayData;
  messageId?: string;
  variant?: 'inline' | 'pinned';
}

/** At or below this count, columns share the full container width. */
const STRETCH_COLUMNS_THRESHOLD = 8;
const STRETCH_COLUMNS_THRESHOLD_EXPANDED = 12;

export default function DataTableView({
  data,
  messageId,
  variant = 'inline',
}: DataTableViewProps) {
  const { t } = useTranslations();
  const locale = useLocaleStore((s) => s.locale);
  const pin = usePinnedTableStore((s) => s.pin);
  const unpin = usePinnedTableStore((s) => s.unpin);
  const pinnedMessageId = usePinnedTableStore((s) => s.messageId);
  const isPinned =
    variant === 'inline' &&
    Boolean(messageId) &&
    pinnedMessageId === messageId;
  const showPinControl = variant === 'inline' && Boolean(messageId);
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>(
    'idle'
  );
  const [filterText, setFilterText] = useState('');
  const [sort, setSort] = useState<SortState | null>(null);
  const [page, setPage] = useState(1);
  const [showHiddenColumns, setShowHiddenColumns] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [expanded, setExpanded] = useState(false);

  const { title, columns, hiddenColumns, rows, meta, sql, params } = data;
  const hiddenColumnCount =
    hiddenColumns?.length ?? meta?.hiddenColumnCount ?? 0;

  const visibleColumns = useMemo(
    () => mergeVisibleColumns(columns, hiddenColumns, showHiddenColumns),
    [columns, hiddenColumns, showHiddenColumns]
  );

  const showUiRowNumber = useMemo(
    () => shouldShowUiRowNumberColumn(rows.length, visibleColumns),
    [rows.length, visibleColumns]
  );

  const displayColumns = useMemo(
    () =>
      withUiRowNumberColumn(
        visibleColumns,
        showUiRowNumber,
        t('table.rowNumber')
      ),
    [visibleColumns, showUiRowNumber, t]
  );

  const processedRows = useMemo(() => {
    const filtered = filterTableRows(rows, visibleColumns, filterText);
    return sortTableRows(filtered, sort, visibleColumns);
  }, [rows, visibleColumns, filterText, sort]);

  const chartSpec = useMemo(
    () => detectChartSpec(visibleColumns, processedRows),
    [visibleColumns, processedRows]
  );

  const showChartTab = chartSpec.chartable;

  const { pageRows, totalPages, page: safePage } = useMemo(
    () => paginateRows(processedRows, page, DEFAULT_PAGE_SIZE),
    [processedRows, page]
  );

  const exportData = useMemo(
    (): TableDisplayData => ({
      ...data,
      columns: displayColumns,
      rows: processedRows,
    }),
    [data, displayColumns, processedRows]
  );

  const isPartialExport =
    Boolean(meta?.truncated) ||
    (!showHiddenColumns && hiddenColumnCount > 0);

  const rangeStart =
    processedRows.length === 0 ? 0 : (safePage - 1) * DEFAULT_PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * DEFAULT_PAGE_SIZE, processedRows.length);

  async function handleCopy() {
    try {
      await copyTableTsv(exportData, locale);
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

  const expandLabel = expanded ? t('table.collapse') : t('table.expand');

  function handlePinToggle() {
    if (!messageId) {
      return;
    }
    if (isPinned) {
      unpin();
    } else {
      pin(messageId, data);
    }
  }

  const pinLabel = isPinned ? t('table.unpin') : t('table.pin');

  if (columns.length === 0 && rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">{t('table.noRows')}</p>
    );
  }

  function renderContent(isExpandedView: boolean) {
    const stretchThreshold = isExpandedView
      ? STRETCH_COLUMNS_THRESHOLD_EXPANDED
      : STRETCH_COLUMNS_THRESHOLD;
    const stretchColumns =
      displayColumns.length > 0 &&
      displayColumns.length <= stretchThreshold;

    return (
      <div className="space-y-2 w-full min-w-0 max-w-full">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {title && (
              <h4 className="text-sm font-semibold text-emerald-400">{title}</h4>
            )}
            {isPinned && (
              <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
                {t('table.pinned')}
              </span>
            )}
          </div>
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
                  onClick={() => downloadTableCsv(exportData, locale)}
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
                {showPinControl && (
                  <button
                    type="button"
                    onClick={handlePinToggle}
                    title={pinLabel}
                    aria-label={pinLabel}
                    aria-pressed={isPinned}
                    className={`inline-flex items-center justify-center rounded-md border p-1.5 transition-colors ${
                      isPinned
                        ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                        : 'border-gray-600/80 bg-gray-800/60 text-gray-200 hover:bg-gray-700/80'
                    }`}
                  >
                    {isPinned ? (
                      <PinOff className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Pin className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  title={expandLabel}
                  aria-label={expandLabel}
                  className="inline-flex items-center justify-center rounded-md border border-gray-600/80 bg-gray-800/60 p-1.5 text-gray-200 hover:bg-gray-700/80 transition-colors"
                >
                  {expanded ? (
                    <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden />
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

        <TableQueryChip sql={sql} params={params} />

        {showChartTab && (
          <div className="flex gap-1 rounded-md border border-gray-600/80 bg-gray-900/50 p-0.5 w-fit">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-gray-700 text-gray-100'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {t('table.viewTable')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('chart')}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                viewMode === 'chart'
                  ? 'bg-gray-700 text-gray-100'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {t('table.viewChart')}
            </button>
          </div>
        )}

        {viewMode === 'chart' && showChartTab && chartSpec.chartable ? (
          <TableChartView
            spec={chartSpec}
            columns={visibleColumns}
            rows={processedRows}
          />
        ) : (
          <>
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
                    {displayColumns.map((col) =>
                      isUiRowNumberColumn(col.key) ? (
                        <th
                          key={col.key}
                          className={
                            stretchColumns
                              ? 'w-10 px-2 py-2.5 font-semibold text-gray-400 text-center'
                              : 'w-10 px-2 py-2.5 font-semibold text-gray-400 text-center whitespace-nowrap'
                          }
                        >
                          {col.label}
                        </th>
                      ) : (
                        <SortableHeader
                          key={col.key}
                          col={col}
                          sort={sort}
                          onSort={handleSort}
                          stretch={stretchColumns}
                        />
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Math.max(displayColumns.length, 1)}
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
                        {displayColumns.map((col) => (
                          <td
                            key={col.key}
                            className={
                              isUiRowNumberColumn(col.key)
                                ? 'px-2 py-2 text-gray-400 border-t border-gray-700/50 align-top text-center tabular-nums text-xs'
                                : stretchColumns
                                  ? 'px-3 py-2 text-gray-100 border-t border-gray-700/50 align-top whitespace-normal break-words'
                                  : 'px-3 py-2 text-gray-100 border-t border-gray-700/50 align-top whitespace-normal break-words max-w-md'
                            }
                          >
                            {isUiRowNumberColumn(col.key) ? (
                              rangeStart + rowIndex
                            ) : (
                              <TableCellValue
                                value={row[col.key]}
                                columnKey={col.key}
                                columnLabel={col.label}
                                columnMeta={col.meta}
                                keyFields={meta?.keyFields}
                                locale={locale}
                              />
                            )}
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
          </>
        )}
      </div>
    );
  }

  const inlineContent = renderContent(false);
  const expandedContent = renderContent(true);

  return (
    <>
      <div
        aria-hidden={expanded || undefined}
        {...(expanded ? { inert: true } : {})}
        className={expanded ? 'opacity-40 pointer-events-none select-none' : undefined}
      >
        {expanded && (
          <p className="mb-2 text-xs text-emerald-400/80" aria-live="polite">
            {t('table.expandedHint')}
          </p>
        )}
        {inlineContent}
      </div>
      {expanded &&
        typeof document !== 'undefined' &&
        createPortal(
          <TableResultOverlay
            isOpen={expanded}
            onClose={() => setExpanded(false)}
            title={title}
            closeLabel={t('table.collapse')}
          >
            {expandedContent}
          </TableResultOverlay>,
          document.body
        )}
    </>
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
