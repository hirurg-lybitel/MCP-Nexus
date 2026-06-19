'use client';

import { useMemo } from 'react';
import CollapsibleToolPanel from './CollapsibleToolPanel';
import { parseListTablesTool } from '@/lib/chat/firebird-tools';
import { useTranslations } from '@/lib/i18n/use-translations';
import TableListDetail from './TableListDetail';

interface ListTablesToolPanelProps {
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  defaultExpanded?: boolean;
  developerMode?: boolean;
}

export default function ListTablesToolPanel({
  toolInput,
  toolResult = '',
  defaultExpanded = false,
  developerMode = false,
}: ListTablesToolPanelProps) {
  const { t } = useTranslations();
  const parsed = useMemo(
    () => parseListTablesTool(toolResult),
    [toolResult]
  );

  const rawLabels = {
    rawSectionLabel: t('tools.rawTranscript'),
    rawInputLabel: t('tools.input'),
    rawResultLabel: t('tools.result'),
  };

  if (parsed.kind === 'error') {
    return (
      <CollapsibleToolPanel
        title={t('tools.firebird.listTables.title')}
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
  const summary =
    count === 0
      ? t('tools.firebird.listTables.none')
      : count === 1
        ? t('tools.firebird.listTables.foundOne', { count })
        : t('tools.firebird.listTables.foundMany', { count });

  return (
    <CollapsibleToolPanel
      title={t('tools.firebird.listTables.title')}
      summary={summary}
      defaultExpanded={defaultExpanded}
      expandable={count > 0}
      developerMode={developerMode}
      toolInput={toolInput}
      toolResult={toolResult}
      {...rawLabels}
    >
      <TableListDetail tables={parsed.tables} showFilter />
    </CollapsibleToolPanel>
  );
}
