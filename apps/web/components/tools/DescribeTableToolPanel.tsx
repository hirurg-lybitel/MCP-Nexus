'use client';

import { useMemo } from 'react';
import CollapsibleToolPanel from './CollapsibleToolPanel';
import SchemaExplorerView from './SchemaExplorerView';
import {
  countSensitiveColumns,
  parseDescribeTableTool,
} from '@/lib/chat/firebird-tools';
import { useTranslations } from '@/lib/i18n/use-translations';

interface DescribeTableToolPanelProps {
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  defaultExpanded?: boolean;
  developerMode?: boolean;
  onSuggestFollowUp?: (text: string) => void;
}

export default function DescribeTableToolPanel({
  toolInput,
  toolResult = '',
  defaultExpanded = false,
  developerMode = false,
  onSuggestFollowUp,
}: DescribeTableToolPanelProps) {
  const { t } = useTranslations();
  const parsed = useMemo(
    () => parseDescribeTableTool(toolInput, toolResult),
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
        title={t('tools.firebird.describeTable.title')}
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

  const { tableName, tableDisplayName, columns } = parsed;
  const sensitiveCount = countSensitiveColumns(columns);
  const colCount = columns.length;

  const namePart = tableName ?? t('tools.firebird.describeTable.unknownTable');
  const displayPart = tableDisplayName?.trim()
    ? ` · ${tableDisplayName.trim()}`
    : '';

  let colPart: string;
  if (colCount === 0) {
    colPart = t('tools.firebird.describeTable.noColumns');
  } else if (colCount === 1) {
    colPart = t('tools.firebird.describeTable.columnOne', { count: colCount });
  } else {
    colPart = t('tools.firebird.describeTable.columnMany', { count: colCount });
  }

  let sensitivePart = '';
  if (sensitiveCount > 0) {
    sensitivePart =
      sensitiveCount === 1
        ? t('tools.firebird.describeTable.sensitiveOne', {
          count: sensitiveCount,
        })
        : t('tools.firebird.describeTable.sensitiveMany', {
          count: sensitiveCount,
        });
  }

  const summary = [namePart + displayPart, colPart, sensitivePart]
    .filter(Boolean)
    .join(' · ');

  return (
    <CollapsibleToolPanel
      title={t('tools.firebird.describeTable.title')}
      summary={summary}
      defaultExpanded={defaultExpanded}
      expandable={colCount > 0}
      developerMode={developerMode}
      toolInput={toolInput}
      toolResult={toolResult}
      {...rawLabels}
    >
      <SchemaExplorerView
        columns={columns}
        onSuggestFollowUp={onSuggestFollowUp}
      />
    </CollapsibleToolPanel>
  );
}
