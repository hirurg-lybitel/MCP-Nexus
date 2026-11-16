import type { TableDisplayData } from '@/types';
import { labelForColumn, normalizeColumnLabels } from './column-labels';
import { buildDisplayTableFromRows } from './column-picker';

const MAX_ACCOUNTING_UI_ROWS = 300;

const ACCOUNTING_COLUMN_LABELS: Record<string, string> = {
  ACCOUNT_ALIAS: 'Счёт',
  ACCOUNT_NAME: 'Название',
  ACCOUNT_ID: 'ID счёта',
  BEGIN_DEBIT: 'Сальдо нач. Дт',
  BEGIN_CREDIT: 'Сальдо нач. Кт',
  DEBIT: 'Оборот Дт',
  CREDIT: 'Оборот Кт',
  END_DEBIT: 'Сальдо кон. Дт',
  END_CREDIT: 'Сальдо кон. Кт',
  OFFBALANCE: 'Забаланс',
  alias: 'Счёт',
  accountName: 'Название',
  corrAlias: 'Корр. счёт',
  corrAccountName: 'Корр. название',
  ncuDebit: 'Дебет NCU',
  ncuCredit: 'Кредит NCU',
  debitNcu: 'Дебет NCU',
  creditNcu: 'Кредит NCU',
  simpleNcu: 'Сальдо (нетто)',
  entryDate: 'Дата',
  groupKey: 'Группа',
  month: 'Месяц',
  documentName: 'Документ',
  number: 'Номер',
  description: 'Содержание',
  name: 'Название',
  className: 'Класс',
  reportKind: 'Тип отчёта',
  id: 'ID',
  analyticsId: 'ID аналитики',
  analyticsName: 'Контрагент / значение',
  lastEntryDate: 'Последняя проводка',
};

type RowSource = {
  keys: string[];
  title: (record: Record<string, unknown>) => string;
};

function balanceTitle(r: Record<string, unknown>): string {
  const alias =
    typeof r.accountAlias === 'string' && r.accountAlias
      ? r.accountAlias
      : String(r.accountKey ?? '');
  const date = typeof r.dateEnd === 'string' ? r.dateEnd : '';
  if (alias && date) return `Сальдо ${alias} на ${date}`;
  if (alias) return `Сальдо ${alias}`;
  return 'Сальдо счёта';
}

const ACCOUNTING_ROW_SOURCES: Record<string, RowSource> = {
  get_trial_balance: {
    keys: ['accounts'],
    title: (r) => {
      const begin = typeof r.dateBegin === 'string' ? r.dateBegin : '';
      const end = typeof r.dateEnd === 'string' ? r.dateEnd : '';
      if (begin && end) return `ОСВ ${begin} – ${end}`;
      return 'ОСВ';
    },
  },
  get_account_analysis: {
    keys: ['rows'],
    title: (r) => {
      const alias =
        typeof r.accountAlias === 'string' && r.accountAlias
          ? r.accountAlias
          : String(r.accountKey ?? '');
      return alias ? `Анализ счёта ${alias}` : 'Анализ счёта';
    },
  },
  get_balance: {
    keys: ['rows'],
    title: balanceTitle,
  },
  get_account_saldo: {
    keys: ['rows'],
    title: balanceTitle,
  },
  get_analytics_balance: {
    keys: ['rows'],
    title: (r) => {
      const alias =
        typeof r.accountAlias === 'string' && r.accountAlias
          ? r.accountAlias
          : String(r.accountKey ?? '');
      const date = typeof r.dateEnd === 'string' ? r.dateEnd : '';
      const label =
        typeof r.fieldLabel === 'string' && r.fieldLabel
          ? r.fieldLabel
          : 'аналитика';
      if (alias && date) return `Развёртка ${alias} по ${label} на ${date}`;
      if (alias) return `Развёртка ${alias} по ${label}`;
      return `Развёртка по ${label}`;
    },
  },
  get_journal_order: {
    keys: ['rows'],
    title: (r) => {
      const alias =
        typeof r.accountAlias === 'string' && r.accountAlias
          ? r.accountAlias
          : String(r.accountKey ?? '');
      return alias ? `Журнал-ордер ${alias}` : 'Журнал-ордер';
    },
  },
  get_account_card: {
    keys: ['entries'],
    title: (r) => {
      const alias =
        typeof r.accountAlias === 'string' && r.accountAlias
          ? r.accountAlias
          : String(r.accountKey ?? '');
      return alias ? `Карта счёта ${alias}` : 'Карта счёта';
    },
  },
  list_report_configs: {
    keys: ['configs', 'rows'],
    title: () => 'Настройки отчётов',
  },
  run_report_config: {
    keys: ['rows', 'accounts', 'entries'],
    title: () => 'Сохранённый отчёт',
  },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Drop nested objects/arrays so the UI table stays flat. */
export function flattenAccountingRow(
  row: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value == null) {
      out[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value.length;
      continue;
    }
    if (typeof value === 'object') {
      continue;
    }
    out[key] = value;
  }
  return out;
}

function pickRowArray(
  record: Record<string, unknown>,
  keys: string[]
): Record<string, unknown>[] | null {
  for (const key of keys) {
    const value = record[key];
    if (!Array.isArray(value) || value.length === 0) continue;
    const rows = value
      .map(asRecord)
      .filter((r): r is Record<string, unknown> => r !== null)
      .map(flattenAccountingRow);
    if (rows.length > 0) return rows;
  }
  return null;
}

export function isAccountingTableTool(toolName: string): boolean {
  return Object.prototype.hasOwnProperty.call(ACCOUNTING_ROW_SOURCES, toolName);
}

export function parseAccountingToolTable(
  toolName: string,
  resultText: string
): TableDisplayData | null {
  const source = ACCOUNTING_ROW_SOURCES[toolName];
  if (!source) return null;

  let data: unknown;
  try {
    data = JSON.parse(resultText);
  } catch {
    return null;
  }

  const record = asRecord(data);
  if (!record || record.error || record.isError) {
    return null;
  }

  const rowObjects = pickRowArray(record, source.keys);
  if (!rowObjects) return null;

  const truncated =
    Boolean(record.truncated) || rowObjects.length > MAX_ACCOUNTING_UI_ROWS;
  const capped =
    rowObjects.length > MAX_ACCOUNTING_UI_ROWS
      ? rowObjects.slice(0, MAX_ACCOUNTING_UI_ROWS)
      : rowObjects;

  const columnLabels = normalizeColumnLabels({
    ...ACCOUNTING_COLUMN_LABELS,
    ...(asRecord(record.columnLabels) as Record<string, string> | null),
  });
  const built = buildDisplayTableFromRows(capped);

  const columns = built.columns.map((key) => ({
    key,
    label: labelForColumn(key, columnLabels),
  }));

  const displayKeySet = new Set(built.columns);
  const allKeys = [...new Set(capped.flatMap((row) => Object.keys(row)))].sort();
  const hiddenColumns = allKeys
    .filter((key) => !displayKeySet.has(key))
    .map((key) => ({
      key,
      label: labelForColumn(key, columnLabels),
    }));

  return {
    title: source.title(record),
    columns,
    hiddenColumns: hiddenColumns.length > 0 ? hiddenColumns : undefined,
    rows: capped,
    meta: {
      rowCount:
        typeof record.rowCount === 'number' ? record.rowCount : rowObjects.length,
      truncated,
      hiddenColumnCount: built.hiddenColumnCount,
      allColumnCount: built.allColumnCount,
    },
  };
}
