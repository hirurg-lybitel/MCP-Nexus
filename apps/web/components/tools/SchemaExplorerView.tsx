'use client';

import type { DescribeColumnInfo } from '@/lib/chat/firebird-tools';
import {
  groupSchemaColumns,
  schemaGroupOrder,
  type SchemaColumnGroup,
} from '@/lib/chat/schema-groups';
import { useTranslations } from '@/lib/i18n/use-translations';

interface SchemaExplorerViewProps {
  columns: DescribeColumnInfo[];
  onSuggestFollowUp?: (text: string) => void;
}

export default function SchemaExplorerView({
  columns,
  onSuggestFollowUp,
}: SchemaExplorerViewProps) {
  const { t } = useTranslations();
  const grouped = groupSchemaColumns(columns);
  const order = schemaGroupOrder();

  const sensitiveCount = grouped.sensitive.length;

  return (
    <div className="space-y-3 min-w-0">
      {sensitiveCount > 0 && (
        <p className="text-[11px] text-red-400/90">
          {sensitiveCount === 1
            ? t('tools.firebird.schema.sensitiveBannerOne', {
              count: sensitiveCount,
            })
            : t('tools.firebird.schema.sensitiveBannerMany', {
              count: sensitiveCount,
            })}
        </p>
      )}

      {order.map((groupKey) => (
        <SchemaGroupSection
          key={groupKey}
          groupKey={groupKey}
          columns={grouped[groupKey]}
          onSuggestFollowUp={onSuggestFollowUp}
        />
      ))}
    </div>
  );
}

function SchemaGroupSection({
  groupKey,
  columns,
  onSuggestFollowUp,
}: {
  groupKey: SchemaColumnGroup;
  columns: DescribeColumnInfo[];
  onSuggestFollowUp?: (text: string) => void;
}) {
  const { t } = useTranslations();

  if (columns.length === 0) {
    return null;
  }

  const titleKey = `tools.firebird.schema.groups.${groupKey}` as const;

  return (
    <section className="min-w-0">
      <h5 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
        {t(titleKey)}
      </h5>
      <ul className="space-y-1">
        {columns.map((col) => (
          <li
            key={col.fieldName}
            className="rounded-md border border-gray-700/60 bg-gray-800/40 px-2 py-1.5 text-[11px] min-w-0"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-mono text-gray-100">{col.fieldName}</span>
              {col.fieldType && (
                <TypeBadge type={col.fieldType} length={col.fieldLength} />
              )}
              {col.nullable === false && (
                <span className="text-[10px] uppercase text-amber-400/90">
                  {t('tools.firebird.schema.notNull')}
                </span>
              )}
              {col.sensitive && (
                <span className="text-[10px] uppercase text-red-400/90">
                  {t('tools.firebird.describeTable.sensitiveBadge')}
                </span>
              )}
            </div>
            {col.displayName?.trim() && (
              <p className="text-gray-400 mt-0.5 truncate">
                {col.displayName.trim()}
              </p>
            )}
            {col.refTable?.trim() && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-gray-400">
                  →{' '}
                  {col.refListField
                    ? `${col.refTable}.${col.refListField}`
                    : col.refTable}
                  {col.refTableDisplayName?.trim()
                    ? ` (${col.refTableDisplayName.trim()})`
                    : ''}
                </span>
                {onSuggestFollowUp && (
                  <button
                    type="button"
                    onClick={() =>
                      onSuggestFollowUp(
                        `Describe table ${col.refTable}`
                      )
                    }
                    className="text-emerald-400/90 hover:text-emerald-300 underline-offset-2 hover:underline"
                  >
                    {t('tools.firebird.schema.suggestFollowUp')}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TypeBadge({
  type,
  length,
}: {
  type: string;
  length?: number | null;
}) {
  const label =
    length != null && length > 0 ? `${type}(${length})` : type;

  return (
    <span className="rounded bg-gray-700/80 px-1.5 py-0.5 font-mono text-[10px] text-gray-300">
      {label}
    </span>
  );
}
