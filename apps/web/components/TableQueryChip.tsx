'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { TableDisplayData } from '@/types';
import { useTranslations } from '@/lib/i18n/use-translations';

interface TableQueryChipProps {
  sql?: string;
  params?: Record<string, unknown>;
}

export default function TableQueryChip({ sql, params }: TableQueryChipProps) {
  const { t } = useTranslations();
  const [expanded, setExpanded] = useState(false);

  if (!sql?.trim()) {
    return null;
  }

  const paramKeys =
    params && typeof params === 'object' ? Object.keys(params) : [];

  return (
    <div className="min-w-0 w-full">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs text-emerald-400/90 hover:text-emerald-300 transition-colors"
        aria-expanded={expanded}
      >
        <span className="font-medium">{t('table.queryLabel')}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
        <span className="text-gray-500">
          {expanded ? t('table.hideQuery') : t('table.showQuery')}
        </span>
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1.5 min-w-0">
          <pre className="overflow-x-auto max-h-48 rounded-md border border-gray-600/80 bg-gray-950/80 p-2 text-emerald-300/90 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">
            {sql.trim()}
          </pre>
          {paramKeys.length > 0 && (
            <p className="text-[11px] text-gray-500 font-mono break-words">
              {t('table.paramsLabel')}:{' '}
              {JSON.stringify(params, null, 0)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function hasTableQuery(data: Pick<TableDisplayData, 'sql'>): boolean {
  return Boolean(data.sql?.trim());
}
