import type { McpServer } from '@modelcontextprotocol/server';
import {
  loadReportWorkerConfig,
  ReportWorkerClient,
  ReportWorkerError,
} from '@mcp-nexus/report-worker';
import * as z from 'zod/v4';
import { resolveAccountKey } from '../lib/account-key.js';
import {
  aliasMatchesFilter,
  parseAliasFilterTokens,
  rowAlias,
  rowOffbalance,
  type AliasFilterToken,
} from '../lib/account-alias-filter.js';
import {
  loadAccountNameIndex,
  lookupAccountName,
  lookupAccountNameById,
  lookupAccountOffbalance,
  type AccountNameIndex,
} from '../lib/account-names.js';
import { resolveActiveChart } from '../lib/active-chart.js';
import { addMoney, formatMoney } from '../lib/money.js';
import {
  accountKeyParam,
  appliedFilters,
  companyKeyParam,
  companyOutputFields,
  isoDateParam,
  allHoldingCompaniesParam,
} from '../lib/report-params.js';
import { mapDbError, toolFailure, toolSuccess } from '../lib/tool-result.js';
import { resolveWorkingCompany } from '../lib/working-company.js';

const inputSchema = z.object({
  companyKey: companyKeyParam,
  dateBegin: isoDateParam('Period start'),
  dateEnd: isoDateParam('Period end'),
  accountKey: accountKeyParam
    .optional()
    .describe(
      'Chart root account id from find_account. When omitted, the active chart of companyKey is used (AC_COMPANYACCOUNT.ISACTIVE = 1). Never pass an alias like 60/62.'
    ),
  includeInternal: z
    .boolean()
    .optional()
    .describe('Include internal entries (DONTINMOVE=0). Default false'),
  allHoldingCompanies: allHoldingCompaniesParam,
  includeOffBalance: z
    .boolean()
    .optional()
    .describe(
      'Include off-balance (забалансовые) accounts. Default false — hide OFFBALANCE=1 unless the user asked for them explicitly.'
    ),
  accountAliases: z
    .array(z.string().min(1))
    .optional()
    .describe(
      'Optional alias filter after the OSB is built. Each item is a prefix ("50","51","60") or a numeric range ("50-62"). ' +
        'Matches the account itself and dotted/dashed children (51-1, 62.4). Totals are recomputed for the filtered rows.'
    ),
});

const outputSchema = z.object({
  source: z.string().optional(),
  companyKey: z.number().optional(),
  ...companyOutputFields,
  dateBegin: z.string().optional(),
  dateEnd: z.string().optional(),
  accountKey: z.number().optional(),
  includeInternal: z.boolean().optional(),
  allHoldingCompanies: z.boolean().optional(),
  includeOffBalance: z.boolean().optional(),
  accountAliases: z.array(z.string()).optional(),
  accounts: z.array(z.record(z.string(), z.unknown())).optional(),
  totals: z.record(z.string(), z.unknown()).optional(),
  rowCount: z.number().optional(),
  dataCutoff: z.string().nullable().optional(),
  appliedFilters: z.record(z.string(), z.unknown()).optional(),
  // Present when isError — SDK validates structuredContent against this schema
  error: z.string().optional(),
  code: z.string().optional(),
});

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const k = key.toUpperCase();
    if (
      k.includes('DEBIT') ||
      k.includes('CREDIT') ||
      k.includes('NCU') ||
      k.includes('CURR') ||
      k.includes('EQ')
    ) {
      out[key] = formatMoney(value);
    } else if (typeof value === 'bigint') {
      out[key] = value.toString();
    } else {
      out[key] = value;
    }
  }
  return out;
}

interface WorkerTrialBalanceRow {
  accountKey?: number | string;
  alias?: string;
  ncuBeginDebit?: number | string;
  ncuBeginCredit?: number | string;
  ncuDebit?: number | string;
  ncuCredit?: number | string;
  ncuEndDebit?: number | string;
  ncuEndCredit?: number | string;
}

interface WorkerTrialBalanceResponse {
  ok?: boolean;
  error?: string;
  message?: string;
  source?: string;
  rows?: WorkerTrialBalanceRow[];
}

function mapWorkerRows(
  rows: WorkerTrialBalanceRow[],
  nameIndex?: AccountNameIndex
): Record<string, unknown>[] {
  return rows.map((row) => {
    const alias = row.alias ?? '';
    const accountId = Number(row.accountKey ?? 0);
    const fromId = nameIndex ? lookupAccountNameById(nameIndex, accountId) : '';
    const fromAlias = nameIndex ? lookupAccountName(nameIndex, alias) : '';
    const offbalance = nameIndex
      ? lookupAccountOffbalance(nameIndex, alias, accountId)
      : 0;
    return normalizeRow({
      ACCOUNT_ALIAS: alias,
      ACCOUNT_NAME: fromId || fromAlias,
      ACCOUNT_ID: accountId,
      BEGIN_DEBIT: row.ncuBeginDebit ?? 0,
      BEGIN_CREDIT: row.ncuBeginCredit ?? 0,
      DEBIT: row.ncuDebit ?? 0,
      CREDIT: row.ncuCredit ?? 0,
      END_DEBIT: row.ncuEndDebit ?? 0,
      END_CREDIT: row.ncuEndCredit ?? 0,
      OFFBALANCE: offbalance,
    });
  });
}

function buildTotals(accounts: Record<string, unknown>[]) {
  const sum = (field: string) =>
    accounts.reduce(
      (acc, row) => addMoney(acc, formatMoney(row[field] ?? '0')),
      '0'
    );

  return {
    begin_debit: sum('BEGIN_DEBIT'),
    begin_credit: sum('BEGIN_CREDIT'),
    debit: sum('DEBIT'),
    credit: sum('CREDIT'),
    end_debit: sum('END_DEBIT'),
    end_credit: sum('END_CREDIT'),
    account_count: accounts.length,
  };
}

/** Procedure rows use lowercase aliases — normalize money field names for totals. */
function normalizeProcedureRow(
  row: Record<string, unknown>
): Record<string, unknown> {
  const n = normalizeRow(row);
  const alias = rowAlias(n);
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      if (n[key] != null) return n[key];
      const upper = key.toUpperCase();
      if (n[upper] != null) return n[upper];
    }
    return '0';
  };
  return {
    ACCOUNT_ALIAS: alias,
    ACCOUNT_NAME: String(
      n.ACCOUNT_NAME ?? n.account_name ?? n.NAME ?? n.name ?? ''
    ),
    ACCOUNT_ID: Number(n.ACCOUNT_ID ?? n.account_id ?? n.ID ?? n.id ?? 0),
    BEGIN_DEBIT: formatMoney(pick('BEGIN_DEBIT', 'begin_debit')),
    BEGIN_CREDIT: formatMoney(pick('BEGIN_CREDIT', 'begin_credit')),
    DEBIT: formatMoney(pick('DEBIT', 'debit')),
    CREDIT: formatMoney(pick('CREDIT', 'credit')),
    END_DEBIT: formatMoney(pick('END_DEBIT', 'end_debit')),
    END_CREDIT: formatMoney(pick('END_CREDIT', 'end_credit')),
    OFFBALANCE: rowOffbalance(n),
  };
}

export function filterTrialBalanceAccounts(
  accounts: Record<string, unknown>[],
  options: {
    includeOffBalance: boolean;
    aliasTokens: AliasFilterToken[];
  }
): Record<string, unknown>[] {
  return accounts.filter((row) => {
    if (!options.includeOffBalance && rowOffbalance(row) !== 0) return false;
    if (
      options.aliasTokens.length &&
      !aliasMatchesFilter(rowAlias(row), options.aliasTokens)
    ) {
      return false;
    }
    return true;
  });
}

type TrialBalanceParams = {
  companyKey: number;
  companyName?: string;
  companyScope?: 'explicit' | 'default_single_working';
  dateBegin: string;
  dateEnd: string;
  accountKey: number;
  includeInternal: boolean;
  allHoldingCompanies: boolean;
  includeOffBalance: boolean;
  accountAliases?: string[];
  aliasTokens: AliasFilterToken[];
};

async function viaWorker(args: TrialBalanceParams) {
  const config = loadReportWorkerConfig();
  if (!config) {
    throw new ReportWorkerError(
      'GEDEMIN_WORKER_USER / GEDEMIN_WORKER_PASSWORD not set',
      'WORKER_NOT_CONFIGURED'
    );
  }

  const client = new ReportWorkerClient(config);
  const raw = (await client.getTrialBalance({
    companyKey: args.companyKey,
    dateBegin: args.dateBegin,
    dateEnd: args.dateEnd,
    accountKey: args.accountKey,
    includeInternal: args.includeInternal,
    allHoldingCompanies: args.allHoldingCompanies,
  })) as WorkerTrialBalanceResponse;

  if (!raw || raw.ok === false) {
    throw new ReportWorkerError(
      raw?.message || raw?.error || 'Worker returned error',
      raw?.error || 'WORKER_REPORT_ERROR'
    );
  }

  let nameIndex: AccountNameIndex | undefined;
  try {
    const { requireDbServices } = await import('@mcp-nexus/db-firebird');
    const db = requireDbServices();
    const chart = await resolveActiveChart(db, args.companyKey);
    if (chart.ok) {
      nameIndex = await loadAccountNameIndex(db, chart.accountKey);
    }
  } catch {
    nameIndex = undefined;
  }

  const mapped = mapWorkerRows(raw.rows ?? [], nameIndex);
  const accounts = filterTrialBalanceAccounts(mapped, {
    includeOffBalance: args.includeOffBalance,
    aliasTokens: args.aliasTokens,
  });
  return toolSuccess({
    source: raw.source || 'tgdv_acct_circulation_list',
    companyKey: args.companyKey,
    companyName: args.companyName,
    companyScope: args.companyScope,
    dateBegin: args.dateBegin,
    dateEnd: args.dateEnd,
    accountKey: args.accountKey,
    includeInternal: args.includeInternal,
    allHoldingCompanies: args.allHoldingCompanies,
    includeOffBalance: args.includeOffBalance,
    ...(args.accountAliases?.length
      ? { accountAliases: args.accountAliases }
      : {}),
    accounts,
    totals: buildTotals(accounts),
    rowCount: accounts.length,
    appliedFilters: appliedFilters(args),
  });
}

async function viaProcedure(args: TrialBalanceParams) {
  const { requireDbServices } = await import('@mcp-nexus/db-firebird');
  const db = requireDbServices();
  const dontInMove = args.includeInternal ? 0 : 1;
  const allHolding = args.allHoldingCompanies ? 1 : 0;
  const sql = `
SELECT
  alias AS account_alias,
  name AS account_name,
  id AS account_id,
  CAST(ncu_begin_debit AS NUMERIC(18,4)) AS begin_debit,
  CAST(ncu_begin_credit AS NUMERIC(18,4)) AS begin_credit,
  CAST(ncu_debit AS NUMERIC(18,4)) AS debit,
  CAST(ncu_credit AS NUMERIC(18,4)) AS credit,
  CAST(ncu_end_debit AS NUMERIC(18,4)) AS end_debit,
  CAST(ncu_end_credit AS NUMERIC(18,4)) AS end_credit,
  offbalance
FROM ac_circulationlist_bal(
  DATE '${args.dateBegin}',
  DATE '${args.dateEnd}',
  ${args.companyKey},
  ${allHolding},
  ${args.accountKey},
  0,
  ${dontInMove}
)
ORDER BY 1`;

  const result = await db.executeSql.run(sql);
  const mapped = result.rows.map((row) =>
    normalizeProcedureRow(row as Record<string, unknown>)
  );
  const accounts = filterTrialBalanceAccounts(mapped, {
    includeOffBalance: args.includeOffBalance,
    aliasTokens: args.aliasTokens,
  });

  return toolSuccess({
    source: 'ac_circulationlist_bal',
    companyKey: args.companyKey,
    companyName: args.companyName,
    companyScope: args.companyScope,
    dateBegin: args.dateBegin,
    dateEnd: args.dateEnd,
    accountKey: args.accountKey,
    includeInternal: args.includeInternal,
    allHoldingCompanies: args.allHoldingCompanies,
    includeOffBalance: args.includeOffBalance,
    ...(args.accountAliases?.length
      ? { accountAliases: args.accountAliases }
      : {}),
    accounts,
    totals: buildTotals(accounts),
    rowCount: accounts.length,
    appliedFilters: appliedFilters(args),
  });
}

export function registerTrialBalanceTool(server: McpServer): void {
  server.registerTool(
    'get_trial_balance',
    {
      title: 'Trial balance (ОСВ)',
      description:
        'Build the trial balance (оборотно-сальдовая ведомость) for a company and period in the connected database. ' +
        'Omit companyKey when the organization is unnamed (server defaults to the only working org); ' +
        'when named, resolve via find_counterparty — never invent companyKey. ' +
        'When accountKey is omitted, the active chart of that company is used — a full-year whole-chart call is heavy; ' +
        'for revenue/profit/cost (accounts 90/99) prefer find_account then get_account_analysis or get_balance instead of a full-year OSB. ' +
        'Off-balance accounts are hidden by default (includeOffBalance=false). ' +
        'To limit to cash/settlements use accountAliases like ["50-62"] or ["50","51","60","62"] — do not pass a single group accountKey for a multi-branch range. ' +
        'Preferred source: Gedemin worker TgdvAcctCirculationList (HTTP). ' +
        'Falls back to AC_CIRCULATIONLIST_BAL if the worker is unavailable. ' +
        'Do not recompute trial balance with run_sql.',
      inputSchema,
      outputSchema,
    },
    async (args) => {
      try {
        const { requireDbServices } = await import('@mcp-nexus/db-firebird');
        const db = requireDbServices();
        const company = await resolveWorkingCompany(db, args.companyKey);
        if (!company.ok) {
          return toolFailure(company.code, company.message, {
            ...(company.companies ? { companies: company.companies } : {}),
          });
        }
        let accountKey = args.accountKey;
        if (accountKey == null) {
          const chart = await resolveActiveChart(db, company.companyKey);
          if (!chart.ok) return toolFailure(chart.code, chart.message);
          accountKey = chart.accountKey;
        } else {
          const account = await resolveAccountKey(db, accountKey);
          if (!account.ok) {
            return toolFailure(account.code, account.message);
          }
          accountKey = account.accountKey;
        }

        const accountAliases = args.accountAliases?.map((s) => s.trim()).filter(Boolean);
        const params: TrialBalanceParams = {
          companyKey: company.companyKey,
          companyName: company.companyName,
          companyScope: company.companyScope,
          dateBegin: args.dateBegin,
          dateEnd: args.dateEnd,
          accountKey,
          includeInternal: args.includeInternal ?? false,
          allHoldingCompanies: args.allHoldingCompanies ?? false,
          includeOffBalance: args.includeOffBalance ?? false,
          ...(accountAliases?.length ? { accountAliases } : {}),
          aliasTokens: parseAliasFilterTokens(accountAliases),
        };

        if (loadReportWorkerConfig()) {
          try {
            return await viaWorker(params);
          } catch (error) {
            if (error instanceof ReportWorkerError) {
              // Fall through to procedure for local/dev when worker is down
              if (
                error.code === 'WORKER_UNAVAILABLE' ||
                error.code === 'WORKER_NOT_CONFIGURED'
              ) {
                return await viaProcedure(params);
              }
              return toolFailure(error.code, error.message);
            }
            throw error;
          }
        }
        return await viaProcedure(params);
      } catch (error) {
        if (error instanceof ReportWorkerError) {
          return toolFailure(error.code, error.message);
        }
        return mapDbError(error);
      }
    }
  );
}
