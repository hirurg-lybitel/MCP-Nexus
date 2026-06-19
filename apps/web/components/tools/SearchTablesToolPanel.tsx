'use client';

import { useMemo } from 'react';
import CollapsibleToolPanel from './CollapsibleToolPanel';
import { parseSearchTablesTool } from '@/lib/chat/firebird-tools';
import { useTranslations } from '@/lib/i18n/use-translations';
import TableListDetail from './TableListDetail';

interface SearchTablesToolPanelProps {
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  defaultExpanded?: boolean;
  developerMode?: boolean;
}

export default function SearchTablesToolPanel({
  toolInput,
  toolResult = '',
  defaultExpanded = false,
  developerMode = false,
}: SearchTablesToolPanelProps) {
  const { t } = useTranslations();
  const parsed = useMemo(
    () => parseSearchTablesTool(toolInput, toolResult),
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
        title={t('tools.firebird.searchTables.title')}
        summary={
          <span className="text-red-400">{parsed.error}</span>
        }
        defaultExpanded={defaultExpanded || true}
        expandable={false}
        developerMode={developerMode}
        toolInput={toolInput}
        toolResult={toolResult}
        {...rawLabels}
      />
    );
  }

  const count = parsed.tables.length;
  const query = parsed.query?.trim() ?? '';

  const summary =
    count === 0
      ? query
        ? t('tools.firebird.searchTables.noneForQuery', { query })
        : t('tools.firebird.searchTables.none')
      : query
        ? count === 1
          ? t('tools.firebird.searchTables.foundOneForQuery', {
            count,
            query,
          })
          : t('tools.firebird.searchTables.foundManyForQuery', {
            count,
            query,
          })
        : count === 1
          ? t('tools.firebird.searchTables.foundOne', { count })
          : t('tools.firebird.searchTables.foundMany', { count });

  return (
    <CollapsibleToolPanel
      title={t('tools.firebird.searchTables.title')}
      summary={summary}
      defaultExpanded={defaultExpanded}
      expandable={count > 0}
      developerMode={developerMode}
      toolInput={toolInput}
      toolResult={toolResult}
      {...rawLabels}
    >
      <TableListDetail tables={parsed.tables} />
    </CollapsibleToolPanel>
  );
}
