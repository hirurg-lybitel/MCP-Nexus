'use client';

import { useState } from 'react';
import type { Locale } from '@/lib/i18n/types';
import type { TableColumnMeta } from '@/types';
import type { TableKeyFields } from '@/lib/chat/table-key-fields';
import {
  formatCellPlainText,
  foreignKeyRefTable,
  isForeignKeyColumn,
  isLongText,
  LONG_TEXT_THRESHOLD,
  resolveDisplayKind,
} from '@/lib/chat/cell-format';
import { useTranslations } from '@/lib/i18n/use-translations';

interface TableCellValueProps {
  value: unknown;
  columnKey: string;
  columnLabel?: string;
  columnMeta?: TableColumnMeta;
  keyFields?: TableKeyFields;
  locale: Locale;
}

export default function TableCellValue({
  value,
  columnKey,
  columnLabel,
  columnMeta,
  keyFields,
  locale,
}: TableCellValueProps) {
  const { t } = useTranslations();
  const [expanded, setExpanded] = useState(false);
  const kind = resolveDisplayKind(value, columnKey, columnMeta, columnLabel);
  const showFkHint = isForeignKeyColumn(columnKey, columnMeta, keyFields);
  const refTable = foreignKeyRefTable(columnMeta);

  if (kind === 'null') {
    return <span className="italic text-gray-500">—</span>;
  }

  if (kind === 'boolean') {
    const isTrue =
      value === true ||
      value === 1 ||
      (typeof value === 'string' &&
        ['true', 'yes', '1'].includes(value.trim().toLowerCase()));
    const label = isTrue ? t('table.cellTrue') : t('table.cellFalse');
    return (
      <span
        className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
          isTrue
            ? 'bg-emerald-500/15 text-emerald-300'
            : 'bg-gray-600/40 text-gray-300'
        }`}
      >
        {label}
      </span>
    );
  }

  if (kind === 'integer' || kind === 'decimal') {
    const text = formatCellPlainText(value, kind, locale);
    return (
      <span className="tabular-nums">
        {text}
        {showFkHint && refTable ? (
          <span className="ml-1.5 text-[11px] text-gray-500 font-mono whitespace-nowrap">
            {t('table.fkRef', { table: refTable })}
          </span>
        ) : null}
      </span>
    );
  }

  if (kind === 'date' || kind === 'datetime' || kind === 'time') {
    const text = formatCellPlainText(value, kind, locale);
    return (
      <span className="tabular-nums text-gray-100">
        {text}
        {showFkHint && refTable ? (
          <span className="ml-1.5 text-[11px] text-gray-500 font-mono whitespace-nowrap">
            {t('table.fkRef', { table: refTable })}
          </span>
        ) : null}
      </span>
    );
  }

  if (kind === 'json') {
    const text = formatCellPlainText(value, kind, locale);
    const display =
      !expanded && text.length > LONG_TEXT_THRESHOLD
        ? `${text.slice(0, LONG_TEXT_THRESHOLD)}…`
        : text;
    return (
      <span className="font-mono text-[12px] text-gray-200 break-all">
        {display}
        {text.length > LONG_TEXT_THRESHOLD && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-1 text-emerald-400/90 hover:text-emerald-300 text-[11px] font-sans"
          >
            {expanded ? t('table.showLess') : t('table.showMore')}
          </button>
        )}
      </span>
    );
  }

  const text = String(value ?? '');
  const long = isLongText(value, kind);
  const display =
    long && !expanded ? `${text.slice(0, LONG_TEXT_THRESHOLD)}…` : text;

  return (
    <span className="text-gray-100">
      {display}
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-1 text-emerald-400/90 hover:text-emerald-300 text-[11px]"
        >
          {expanded ? t('table.showLess') : t('table.showMore')}
        </button>
      )}
      {showFkHint && refTable ? (
        <span className="ml-1.5 text-[11px] text-gray-500 font-mono whitespace-nowrap">
          {t('table.fkRef', { table: refTable })}
        </span>
      ) : null}
    </span>
  );
}
