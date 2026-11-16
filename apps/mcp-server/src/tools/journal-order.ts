import type { McpServer } from '@modelcontextprotocol/server';
import { journalOrderSql } from '@mcp-nexus/accounting-sql';
import * as z from 'zod/v4';
import { resolveAccountKey } from '../lib/account-key.js';
import {
  loadAccountNameIndex,
  lookupAccountName,
  type AccountNameIndex,
} from '../lib/account-names.js';
import { resolveActiveChart } from '../lib/active-chart.js';
import { addMoney, formatMoney } from '../lib/money.js';
import {
  accountKeyParam,
  allHoldingCompaniesParam,
  appliedFilters,
  companyKeyParam,
  companyOutputFields,
  includeInternalParam,
  isoDateParam,
  withSubAccountsParam,
} from '../lib/report-params.js';
import { mapDbError, toolFailure, toolSuccess } from '../lib/tool-result.js';
import { resolveWorkingCompany } from '../lib/working-company.js';

const inputSchema = z.object({
  companyKey: companyKeyParam,
  dateBegin: isoDateParam('Period start'),
  dateEnd: isoDateParam('Period end'),
  accountKey: accountKeyParam,
  includeInternal: includeInternalParam,
  allHoldingCompanies: allHoldingCompaniesParam,
  withSubAccounts: withSubAccountsParam,
  groupBy: z
    .enum(['ENTRYDATE', 'MONTH', 'NONE'])
    .optional()
    .describe(
      'Row grouping: ENTRYDATE (default, one row per day), MONTH (monthly totals — use for «за месяц / итог периода»), or NONE (one total row by correspondent). ' +
        'Do not sum ENTRYDATE rows yourself — switch to MONTH or NONE and read ncuDebit/ncuCredit from the tool output.'
    ),
});

const outputSchema = z.object({
  source: z.string().optional(),
  companyKey: z.number().optional(),
  ...companyOutputFields,
  accountKey: z.number().optional(),
  dateBegin: z.string().optional(),
  dateEnd: z.string().optional(),
  includeInternal: z.boolean().optional(),
  withSubAccounts: z.boolean().optional(),
  allHoldingCompanies: z.boolean().optional(),
  appliedFilters: z.record(z.string(), z.unknown()).optional(),
  groupBy: z.string().optional(),
  rows: z.array(z.record(z.string(), z.unknown())).optional(),
  rowCount: z.number().optional(),
  dataCutoff: z.string().nullable().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

/** Normalize worker/SQL entryDate (dd.mm.yyyy or ISO) to YYYY-MM-DD when possible. */
function normalizeDate(raw: string): string {
  const s = String(raw ?? '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s);
  if (dmy) {
    return `${dmy[3]}-${dmy[2]!.padStart(2, '0')}-${dmy[1]!.padStart(2, '0')}`;
  }
  return s;
}

function monthKey(isoOrRaw: string): string {
  const iso = normalizeDate(isoOrRaw);
  return iso.length >= 7 ? iso.slice(0, 7) : iso;
}

interface JoLine {
  entryDate?: string;
  alias?: string;
  corrAlias?: string;
  ncuDebit?: number | string;
  ncuCredit?: number | string;
}

/**
 * Journal-order shaped pivot of aggregated correspondence lines.
 * Lines come from Firebird CTE (issimple pairs), not AccCard dump.
 */
export function pivotJournal(
  entries: JoLine[],
  groupBy: 'ENTRYDATE' | 'MONTH' | 'NONE',
  nameIndex?: AccountNameIndex
): Record<string, unknown>[] {
  type Bucket = {
    key: string;
    alias: string;
    ncuDebit: string;
    ncuCredit: string;
    corr: Record<string, { ncuDebit: string; ncuCredit: string }>;
  };
  const buckets = new Map<string, Bucket>();
  const emptyIndex: AccountNameIndex = {
    byAlias: new Map(),
    byId: new Map(),
    offbalanceByAlias: new Map(),
  };
  const names = nameIndex ?? emptyIndex;

  for (const row of entries) {
    const entryDate = normalizeDate(String(row.entryDate ?? ''));
    const key =
      groupBy === 'NONE'
        ? 'TOTAL'
        : groupBy === 'MONTH'
          ? monthKey(entryDate)
          : entryDate;
    const alias = String(row.alias ?? '');
    const corrAlias = String(row.corrAlias ?? '').trim() || '(none)';
    const debit = formatMoney(row.ncuDebit);
    const credit = formatMoney(row.ncuCredit);

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        alias,
        ncuDebit: '0',
        ncuCredit: '0',
        corr: {},
      };
      buckets.set(key, bucket);
    }
    bucket.ncuDebit = addMoney(bucket.ncuDebit, debit);
    bucket.ncuCredit = addMoney(bucket.ncuCredit, credit);
    if (!bucket.corr[corrAlias]) {
      bucket.corr[corrAlias] = { ncuDebit: '0', ncuCredit: '0' };
    }
    bucket.corr[corrAlias]!.ncuDebit = addMoney(
      bucket.corr[corrAlias]!.ncuDebit,
      debit
    );
    bucket.corr[corrAlias]!.ncuCredit = addMoney(
      bucket.corr[corrAlias]!.ncuCredit,
      credit
    );
  }

  const keys = [...buckets.keys()].sort();
  return keys.map((k) => {
    const b = buckets.get(k)!;
    const out: Record<string, unknown> = {
      groupKey: b.key,
      alias: b.alias,
      accountName: lookupAccountName(names, b.alias),
      ncuDebit: b.ncuDebit,
      ncuCredit: b.ncuCredit,
      correspondence: Object.entries(b.corr)
        .sort(([a], [c]) => a.localeCompare(c))
        .map(([corrAlias, sums]) => ({
          corrAlias,
          corrAccountName: lookupAccountName(names, corrAlias),
          ncuDebit: sums.ncuDebit,
          ncuCredit: sums.ncuCredit,
        })),
    };
    if (groupBy === 'ENTRYDATE') out.entryDate = b.key;
    if (groupBy === 'MONTH') out.month = b.key;
    return out;
  });
}

function rowField(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] != null) return row[key];
    const upper = key.toUpperCase();
    if (row[upper] != null) return row[upper];
  }
  return undefined;
}

export function registerJournalOrderTool(server: McpServer): void {
  server.registerTool(
    'get_journal_order',
    {
      title: 'Journal-order (журнал-ордер)',
      description:
        'Journal-order view for one account and period: rows grouped by date/month with turnover and correspondence breakdown. ' +
        'Built from Firebird CTE over AC_ENTRY issimple pairs (not AccCard dump). ' +
        'For month or period totals set groupBy=MONTH (or NONE) and read ncuDebit/ncuCredit from the returned rows — never sum daily ENTRYDATE rows yourself. ' +
        'Resolve accountKey via find_account. Omit companyKey when unnamed; when named, use find_counterparty — never invent. ' +
        'Do not rebuild with run_sql.',
      inputSchema,
      outputSchema,
    },
    async (args) => {
      const groupBy = args.groupBy ?? 'ENTRYDATE';

      try {
        const { requireDbServices } = await import('@mcp-nexus/db-firebird');
        const db = requireDbServices();
        const company = await resolveWorkingCompany(db, args.companyKey);
        if (!company.ok) {
          return toolFailure(company.code, company.message, {
            ...(company.companies ? { companies: company.companies } : {}),
          });
        }
        const account = await resolveAccountKey(db, args.accountKey);
        if (!account.ok) {
          return toolFailure(account.code, account.message);
        }
        const params = {
          companyKey: company.companyKey,
          dateBegin: args.dateBegin,
          dateEnd: args.dateEnd,
          accountKey: account.accountKey,
          includeInternal: args.includeInternal ?? false,
          allHoldingCompanies: args.allHoldingCompanies ?? false,
          withSubAccounts: args.withSubAccounts ?? true,
        };
        const filterMeta = {
          ...params,
          companyName: company.companyName,
          companyScope: company.companyScope,
        };

        const sql = journalOrderSql(
          {
            accountKey: params.accountKey,
            withSubAccounts: params.withSubAccounts,
          },
          { dateBegin: params.dateBegin, dateEnd: params.dateEnd },
          {
            companyKey: params.companyKey,
            allHoldingCompanies: params.allHoldingCompanies,
          },
          { excludeInternal: !params.includeInternal }
        );
        const result = await db.executeSql.run(sql);
        const lines: JoLine[] = result.rows.map((raw) => {
          const row = raw as Record<string, unknown>;
          return {
            entryDate: String(rowField(row, 'entrydate', 'ENTRYDATE') ?? ''),
            alias: String(rowField(row, 'alias', 'ALIAS') ?? ''),
            corrAlias: String(rowField(row, 'corr_alias', 'CORR_ALIAS') ?? ''),
            ncuDebit: rowField(row, 'ncu_debit', 'NCU_DEBIT') as
              | number
              | string
              | undefined,
            ncuCredit: rowField(row, 'ncu_credit', 'NCU_CREDIT') as
              | number
              | string
              | undefined,
          };
        });

        let nameIndex: AccountNameIndex = {
          byAlias: new Map(),
          byId: new Map(),
          offbalanceByAlias: new Map(),
        };
        const chart = await resolveActiveChart(db, company.companyKey);
        if (chart.ok) {
          nameIndex = await loadAccountNameIndex(db, chart.accountKey);
        }

        const rows = pivotJournal(lines, groupBy, nameIndex);
        return toolSuccess({
          source: 'ac_entry_issimple_pivot',
          companyKey: params.companyKey,
          companyName: company.companyName,
          companyScope: company.companyScope,
          accountKey: params.accountKey,
          dateBegin: params.dateBegin,
          dateEnd: params.dateEnd,
          includeInternal: params.includeInternal,
          withSubAccounts: params.withSubAccounts,
          allHoldingCompanies: params.allHoldingCompanies,
          appliedFilters: appliedFilters(filterMeta),
          groupBy,
          rows,
          rowCount: rows.length,
        });
      } catch (error) {
        return mapDbError(error);
      }
    }
  );
}
