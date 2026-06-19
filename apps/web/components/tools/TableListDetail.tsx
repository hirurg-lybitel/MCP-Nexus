'use client';

import { useMemo, useState } from 'react';
import type { TableInfo } from '@/lib/chat/firebird-tools';
import { useTranslations } from '@/lib/i18n/use-translations';

interface TableListDetailProps {
  tables: TableInfo[];
  showFilter?: boolean;
}

export default function TableListDetail({
  tables,
  showFilter = false,
}: TableListDetailProps) {
  const { t } = useTranslations();
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) {
      return tables;
    }
    return tables.filter(
      (tbl) =>
        tbl.tableName.toLowerCase().includes(q) ||
        (tbl.displayName?.toLowerCase().includes(q) ?? false)
    );
  }, [tables, filter]);

  return (
    <div className="space-y-2 min-w-0">
      {showFilter && tables.length > 8 && (
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('tools.firebird.tableList.filterPlaceholder')}
          className="w-full rounded border border-gray-600/80 bg-gray-950/80 px-2 py-1.5 text-[11px] text-gray-200 placeholder:text-gray-500"
        />
      )}
      <div className="max-h-48 overflow-y-auto overflow-x-hidden space-y-1">
        {filtered.length === 0 ? (
          <p className="text-gray-500 italic">{t('tools.firebird.tableList.noMatch')}</p>
        ) : (
          filtered.map((tbl) => (
            <div
              key={tbl.tableName}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0"
            >
              <span className="font-mono text-gray-100 shrink-0">
                {tbl.tableName}
              </span>
              {tbl.displayName && (
                <span className="text-gray-400 truncate">
                  {tbl.displayName}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
