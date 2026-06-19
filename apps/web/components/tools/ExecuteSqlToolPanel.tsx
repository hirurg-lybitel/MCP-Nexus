'use client';

import { useMemo } from 'react';
import CollapsibleToolPanel from './CollapsibleToolPanel';
import {
  formatColumnList,
  parseExecuteSqlTool,
} from '@/lib/chat/firebird-tools';
import { useTranslations } from '@/lib/i18n/use-translations';

interface ExecuteSqlToolPanelProps {
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  defaultExpanded?: boolean;
  developerMode?: boolean;
}

export default function ExecuteSqlToolPanel({
  toolInput,
  toolResult = '',
  defaultExpanded = false,
  developerMode = false,
}: ExecuteSqlToolPanelProps) {
  const { t } = useTranslations();
  const parsed = useMemo(
    () => parseExecuteSqlTool(toolInput, toolResult),
    [toolInput, toolResult]
  );

  const rawLabels = {
    rawSectionLabel: t('tools.rawTranscript'),
    rawInputLabel: t('tools.input'),
    rawResultLabel: t('tools.result'),
  };

  if (parsed.kind === 'error') {
    return (
      <CollapsibleToolPanel
        title={t('tools.firebird.executeSql.title')}
        summary={
          <span className="text-red-400">{parsed.message}</span>
        }
        defaultExpanded={defaultExpanded}
        expandable={false}
        developerMode={developerMode}
        toolInput={toolInput}
        toolResult={toolResult}
        {...rawLabels}
      />
    );
  }

  const { rowCount, columns, truncated, sql } = parsed;
  const columnText = formatColumnList(columns);
  const summaryParts: string[] = [];
  summaryParts.push(
    rowCount === 1
      ? t('tools.firebird.executeSql.rowOne', { count: rowCount })
      : t('tools.firebird.executeSql.rowMany', { count: rowCount })
  );
  if (columnText) {
    summaryParts.push(columnText);
  }
  if (truncated) {
    summaryParts.push(t('table.truncated'));
  }

  return (
    <CollapsibleToolPanel
      title={t('tools.firebird.executeSql.title')}
      summary={summaryParts.join(' · ')}
      defaultExpanded={defaultExpanded}
      expandable={Boolean(sql || columns.length > 0)}
      developerMode={developerMode}
      toolInput={toolInput}
      toolResult={toolResult}
      {...rawLabels}
    >
      {sql && (
        <div className="space-y-1 min-w-0 mb-2">
          <span className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">
            {t('tools.firebird.executeSql.sqlLabel')}
          </span>
          <pre className="overflow-x-auto max-h-48 rounded bg-gray-950/80 p-2 text-emerald-300/90 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">
            {sql}
          </pre>
        </div>
      )}
      {columns.length > 0 && (
        <div className="space-y-1 min-w-0">
          <span className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">
            {t('tools.firebird.executeSql.columnsLabel')}
          </span>
          <p className="text-gray-200 font-mono text-[11px] break-words">
            {columns.join(', ')}
          </p>
        </div>
      )}
    </CollapsibleToolPanel>
  );
}
