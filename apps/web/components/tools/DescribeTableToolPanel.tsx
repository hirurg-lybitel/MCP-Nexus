'use client';

import { useMemo } from 'react';
import CollapsibleToolPanel from './CollapsibleToolPanel';
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
}

export default function DescribeTableToolPanel({
  toolInput,
  toolResult = '',
  defaultExpanded = false,
  developerMode = false,
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
      <div className="overflow-x-auto max-w-full min-w-0">
        <table className="min-w-max w-full text-left text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-gray-600/80 text-gray-400">
              <th className="px-2 py-1.5 font-medium">{t('tools.firebird.describeTable.field')}</th>
              <th className="px-2 py-1.5 font-medium">{t('tools.firebird.describeTable.displayName')}</th>
              <th className="px-2 py-1.5 font-medium">{t('tools.firebird.describeTable.ref')}</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((col) => (
              <tr
                key={col.fieldName}
                className="border-t border-gray-700/50 even:bg-gray-800/30"
              >
                <td className="px-2 py-1.5 font-mono text-gray-100 whitespace-nowrap">
                  {col.fieldName}
                  {col.sensitive && (
                    <span className="ml-1.5 text-[10px] uppercase text-red-400/90 font-sans">
                      {t('tools.firebird.describeTable.sensitiveBadge')}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-gray-300 max-w-[12rem] truncate">
                  {col.displayName?.trim() || '—'}
                </td>
                <td className="px-2 py-1.5 font-mono text-gray-400 whitespace-nowrap">
                  {col.refTable
                    ? col.refListField
                      ? `${col.refTable}.${col.refListField}`
                      : col.refTable
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapsibleToolPanel>
  );
}
