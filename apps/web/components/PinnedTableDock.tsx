'use client';

import { useState } from 'react';
import { ChevronDown, PinOff } from 'lucide-react';
import DataTableView from './DataTableView';
import { CHAT_CONTENT_MAX_WIDTH } from '@/constants';
import { useTranslations } from '@/lib/i18n/use-translations';
import { usePinnedTableStore } from '@/stores/usePinnedTableStore';

export default function PinnedTableDock() {
  const { t } = useTranslations();
  const data = usePinnedTableStore((s) => s.data);
  const messageId = usePinnedTableStore((s) => s.messageId);
  const unpin = usePinnedTableStore((s) => s.unpin);
  const [collapsed, setCollapsed] = useState(false);

  if (!data || !messageId) {
    return null;
  }

  const title = data.title?.trim() || t('table.pinnedDockLabel');
  const rowCount = data.meta?.rowCount ?? data.rows.length;

  return (
    <div
      role="region"
      aria-label={t('table.pinnedDockLabel')}
      className={`z-50 mx-auto w-full ${CHAT_CONTENT_MAX_WIDTH} shrink-0 border-b border-l border-r rounded-b-lg border-gray-700/80 bg-gray-900/95`}
    >
      <div className={`w-full min-w-0 px-6 py-2`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-emerald-400/90">
              {t('table.pinned')}
            </span>
            <span className="truncate text-sm font-semibold text-gray-100">
              {title}
            </span>
            <span className="text-xs text-gray-400 tabular-nums">
              {rowCount === 1
                ? t('table.rowCountOne', { count: rowCount })
                : t('table.rowCountMany', { count: rowCount })}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              title={
                collapsed ? t('table.expandDock') : t('table.collapseDock')
              }
              aria-label={
                collapsed ? t('table.expandDock') : t('table.collapseDock')
              }
              aria-expanded={!collapsed}
              className="inline-flex items-center justify-center rounded-md border border-gray-600/80 bg-gray-800/60 p-1.5 text-gray-200 hover:bg-gray-700/80 transition-[color,transform] duration-200 ease-in-out active:scale-95"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ease-in-out ${
                  collapsed ? '' : 'rotate-180'
                }`}
                aria-hidden
              />
            </button>
            <button
              type="button"
              onClick={unpin}
              title={t('table.unpin')}
              aria-label={t('table.unpin')}
              className="inline-flex items-center gap-1 rounded-md border border-gray-600/80 bg-gray-800/60 px-2 py-1.5 text-xs text-gray-200 hover:bg-gray-700/80 transition-colors"
            >
              <PinOff className="h-3.5 w-3.5" aria-hidden />
              {t('table.unpin')}
            </button>
          </div>
        </div>
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
            collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
          }`}
          aria-hidden={collapsed}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className={`mt-2 max-h-[min(40vh,28rem)] overflow-auto rounded-md border border-gray-700/60 bg-gray-950/40 p-2 transition-opacity duration-300 ease-in-out ${
                collapsed ? 'opacity-0' : 'opacity-100'
              }`}
            >
              <DataTableView
                data={data}
                messageId={messageId}
                variant="pinned"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
