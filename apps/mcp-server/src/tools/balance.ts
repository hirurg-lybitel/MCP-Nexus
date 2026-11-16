import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { resolveAccountKey } from '../lib/account-key.js';
import { resolveActiveChart } from '../lib/active-chart.js';
import { addMoney, formatMoney, subMoney } from '../lib/money.js';
import {
  accountKeyParam,
  allHoldingCompaniesParam,
  appliedFilters,
  companyKeyParam,
  companyOutputFields,
  isoDateParam,
  relatedSiblingAccountSchema,
  withSubAccountsParam,
} from '../lib/report-params.js';
import { findRelatedSiblingAccounts } from '../lib/sibling-accounts.js';
import { mapDbError, toolFailure, toolSuccess } from '../lib/tool-result.js';
import { resolveWorkingCompany } from '../lib/working-company.js';

const inputSchema = z.object({
  companyKey: companyKeyParam,
  accountKey: accountKeyParam,
  dateEnd: isoDateParam('Saldo as of this date'),
  fieldName: z
    .string()
    .optional()
    .describe(
      'Group field for AC_ACCOUNTEXSALDO_BAL. Default ACCOUNTKEY (one row per account). ' +
        'Passing a USR$ analytics column still returns amounts without analytics ids/names — ' +
        'for top debtors/creditors or customer breakdown use get_analytics_balance instead.'
    ),
  withSubAccounts: withSubAccountsParam,
  summaryOnly: z
    .boolean()
    .optional()
    .describe(
      'Return only aggregated totals without the per-subaccount rows array (calculation still includes subaccounts when withSubAccounts=true). Default false.'
    ),
  allHoldingCompanies: allHoldingCompaniesParam,
  currKey: z
    .number()
    .int()
    .optional()
    .describe('Currency key (0 = all / NCU). Default 0'),
});

const outputSchema = z.object({
  source: z.string().optional(),
  companyKey: z.number().optional(),
  ...companyOutputFields,
  accountKey: z.number().optional(),
  dateEnd: z.string().optional(),
  fieldName: z.string().optional(),
  withSubAccounts: z.boolean().optional(),
  summaryOnly: z.boolean().optional(),
  subAccountCount: z.number().optional(),
  rows: z.array(z.record(z.string(), z.unknown())).optional(),
  rowCount: z.number().optional(),
  totals: z
    .object({
      debitNcu: z.string(),
      creditNcu: z.string(),
      debitCurr: z.string(),
      creditCurr: z.string(),
      debitEq: z.string(),
      creditEq: z.string(),
      simpleNcu: z.string(),
    })
    .optional(),
  accountAlias: z.string().optional(),
  accountName: z.string().optional(),
  relatedSiblingAccounts: z.array(relatedSiblingAccountSchema).optional(),
  appliedFilters: z.record(z.string(), z.unknown()).optional(),
  dataCutoff: z.string().nullable().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
    const upper = key.toUpperCase();
    if (row[upper] !== undefined) return row[upper];
  }
  return undefined;
}

type SaldoRow = {
  accountKey?: number;
  alias?: string;
  name?: string;
  debitNcu: string;
  creditNcu: string;
  debitCurr: string;
  creditCurr: string;
  debitEq: string;
  creditEq: string;
  simpleNcu: string;
};

async function saldoForAccount(
  db: { executeSql: { run: (sql: string) => Promise<{ rows: unknown[] }> } },
  args: {
    dateEnd: string;
    accountKey: number;
    fieldName: string;
    companyKey: number;
    allHolding: number;
    currKey: number;
    alias?: string;
    name?: string;
  }
): Promise<SaldoRow[]> {
  const fieldLiteral = args.fieldName.replace(/'/g, "''");
  const sql = `
SELECT
  CAST(debitsaldo AS NUMERIC(18,4)) AS debit_ncu,
  CAST(creditsaldo AS NUMERIC(18,4)) AS credit_ncu,
  CAST(currdebitsaldo AS NUMERIC(18,4)) AS debit_curr,
  CAST(currcreditsaldo AS NUMERIC(18,4)) AS credit_curr,
  CAST(eqdebitsaldo AS NUMERIC(18,4)) AS debit_eq,
  CAST(eqcreditsaldo AS NUMERIC(18,4)) AS credit_eq
FROM ac_accountexsaldo_bal(
  DATE '${args.dateEnd}',
  ${args.accountKey},
  '${fieldLiteral}',
  ${args.companyKey},
  ${args.allHolding},
  ${args.currKey}
)`;
  const result = await db.executeSql.run(sql);
  return result.rows.map((row) => {
    const r = row as Record<string, unknown>;
    const debitNcu = formatMoney(pick(r, 'debit_ncu', 'DEBIT_NCU', 'DEBITSALDO'));
    const creditNcu = formatMoney(pick(r, 'credit_ncu', 'CREDIT_NCU', 'CREDITSALDO'));
    return {
      accountKey: args.accountKey,
      alias: args.alias,
      name: args.name,
      debitNcu,
      creditNcu,
      debitCurr: formatMoney(pick(r, 'debit_curr', 'DEBIT_CURR', 'CURRDEBITSALDO')),
      creditCurr: formatMoney(pick(r, 'credit_curr', 'CREDIT_CURR', 'CURRCREDITSALDO')),
      debitEq: formatMoney(pick(r, 'debit_eq', 'DEBIT_EQ', 'EQDEBITSALDO')),
      creditEq: formatMoney(pick(r, 'credit_eq', 'CREDIT_EQ', 'EQCREDITSALDO')),
      simpleNcu: subMoney(debitNcu, creditNcu),
    };
  });
}

type BalanceArgs = Omit<z.infer<typeof inputSchema>, 'companyKey'> & {
  companyKey: number;
  companyName?: string;
  companyScope?: 'explicit' | 'default_single_working';
  accountAlias?: string;
  accountName?: string;
};

type BalanceDb = {
  executeSql: {
    run: (sql: string) => Promise<{ rows: unknown[] }>;
  };
};

export async function computeAccountBalance(
  args: BalanceArgs,
  injectedDb?: BalanceDb
) {
  const fieldName = (args.fieldName ?? 'ACCOUNTKEY').trim() || 'ACCOUNTKEY';
  const withSubAccounts = args.withSubAccounts ?? true;
  const summaryOnly = args.summaryOnly ?? false;
  const allHolding = args.allHoldingCompanies ? 1 : 0;
  const currKey = args.currKey ?? 0;

  const db =
    injectedDb ??
    (await import('@mcp-nexus/db-firebird')).requireDbServices();

  let accountAlias = args.accountAlias ?? '';
  let accountName = args.accountName ?? '';
  if (!accountAlias || !accountName) {
    const rootMeta = await db.executeSql.run(`
SELECT FIRST 1 a.alias, a.name
FROM ac_account a
WHERE a.id = ${args.accountKey}`);
    const meta = rootMeta.rows[0] as Record<string, unknown> | undefined;
    if (meta) {
      accountAlias = accountAlias || String(meta.ALIAS ?? meta.alias ?? '');
      accountName = accountName || String(meta.NAME ?? meta.name ?? '');
    }
  }

  let relatedSiblingAccounts: Array<{
    accountKey: number;
    alias: string;
    name: string;
    accountType: string;
  }> = [];
  const chart = await resolveActiveChart(db, args.companyKey);
  if (chart.ok) {
    relatedSiblingAccounts = await findRelatedSiblingAccounts(db, {
      accountKey: args.accountKey,
      chartRootId: chart.accountKey,
      alias: accountAlias,
    });
  }

  const targets: Array<{ id: number; alias: string; name: string }> = [];
  if (withSubAccounts) {
    const children = await db.executeSql.run(`
SELECT a.id, a.alias, a.name
FROM ac_account a
JOIN ac_account root ON root.id = ${args.accountKey}
WHERE a.lb >= root.lb
  AND a.rb <= root.rb
  AND a.accounttype IN ('A', 'S')
ORDER BY a.alias`);
    for (const row of children.rows) {
      const r = row as Record<string, unknown>;
      targets.push({
        id: Number(r.ID ?? r.id),
        alias: String(r.ALIAS ?? r.alias ?? ''),
        name: String(r.NAME ?? r.name ?? ''),
      });
    }
  }
  if (targets.length === 0) {
    targets.push({
      id: args.accountKey,
      alias: accountAlias,
      name: accountName,
    });
  }

  const rows: SaldoRow[] = [];
  for (const target of targets) {
    const part = await saldoForAccount(db, {
      dateEnd: args.dateEnd,
      accountKey: target.id,
      fieldName,
      companyKey: args.companyKey,
      allHolding,
      currKey,
      alias: target.alias || undefined,
      name: target.name || undefined,
    });
    rows.push(...part);
  }

  const totals = rows.reduce(
    (acc, row) => ({
      debitNcu: addMoney(acc.debitNcu, row.debitNcu),
      creditNcu: addMoney(acc.creditNcu, row.creditNcu),
      debitCurr: addMoney(acc.debitCurr, row.debitCurr),
      creditCurr: addMoney(acc.creditCurr, row.creditCurr),
      debitEq: addMoney(acc.debitEq, row.debitEq),
      creditEq: addMoney(acc.creditEq, row.creditEq),
      simpleNcu: addMoney(acc.simpleNcu, row.simpleNcu),
    }),
    {
      debitNcu: '0',
      creditNcu: '0',
      debitCurr: '0',
      creditCurr: '0',
      debitEq: '0',
      creditEq: '0',
      simpleNcu: '0',
    }
  );

  const visibleRows = summaryOnly ? [] : rows;

  return {
    source: 'ac_accountexsaldo_bal',
    companyKey: args.companyKey,
    companyName: args.companyName,
    companyScope: args.companyScope,
    accountKey: args.accountKey,
    accountAlias: accountAlias || undefined,
    accountName: accountName || undefined,
    dateEnd: args.dateEnd,
    fieldName,
    withSubAccounts,
    summaryOnly,
    subAccountCount: rows.length,
    ...(summaryOnly ? {} : { rows: visibleRows }),
    rowCount: visibleRows.length,
    totals,
    relatedSiblingAccounts,
    appliedFilters: appliedFilters({
      companyKey: args.companyKey,
      companyName: args.companyName,
      companyScope: args.companyScope,
      accountKey: args.accountKey,
      dateEnd: args.dateEnd,
      withSubAccounts,
      summaryOnly,
      allHoldingCompanies: args.allHoldingCompanies ?? false,
      fieldName,
      currKey,
    }),
  };
}

async function runBalanceTool(args: z.infer<typeof inputSchema>) {
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
  return toolSuccess(
    await computeAccountBalance({
      ...args,
      companyKey: company.companyKey,
      companyName: company.companyName,
      companyScope: company.companyScope,
      accountKey: account.accountKey,
      accountAlias: account.alias,
      accountName: account.name,
    })
  );
}

export function registerBalanceTool(server: McpServer): void {
  server.registerTool(
    'get_balance',
    {
      title: 'Account balance on date',
      description:
        'Collapsed or expanded account saldo on a date via AC_ACCOUNTEXSALDO_BAL (NCU, currency, equivalent). ' +
        'Use for debt / overpayment / DZ / KZ / cash sufficiency on a date — read totals.debitNcu and totals.creditNcu (not rows[0]; simpleNcu alone is net, not "кредиторка" when both sides are nonzero). ' +
        'Omit companyKey when the organization is unnamed; when named, resolve via find_counterparty — never invent. ' +
        'Resolve accountKey via find_account first — never pass an alias (60/62) as accountKey. ' +
        'withSubAccounts defaults to true (includes every A/S node under LB/RB). ' +
        'Never pass withSubAccounts=false when the user says "итогами / без субсчетов в ответе" — pass summaryOnly=true with withSubAccounts=true instead. ' +
        'When relatedSiblingAccounts is non-empty (e.g. 51-1 beside 51), those aliases are outside LB/RB — call get_balance for each sibling too for cash/group totals. ' +
        'Director DZ/KZ / cash sufficiency: use this tool without analytics fieldName (default ACCOUNTKEY) and read totals.debitNcu / totals.creditNcu. ' +
        'For named top debtors/creditors use get_analytics_balance (same fieldName as here if you need that field’s expanded totals). ' +
        'Prefer this over get_account_analysis and run_sql for on-date saldo. get_account_saldo is the same tool under the old name.',
      inputSchema,
      outputSchema,
    },
    async (args) => {
      try {
        return await runBalanceTool(args);
      } catch (error) {
        return mapDbError(error);
      }
    }
  );
}

/** Keep the older name as an alias with the same behaviour. */
export function registerAccountSaldoTool(server: McpServer): void {
  server.registerTool(
    'get_account_saldo',
    {
      title: 'Account saldo on date',
      description:
        'Alias of get_balance. Account saldo on a date via AC_ACCOUNTEXSALDO_BAL. Prefer get_balance in new prompts.',
      inputSchema,
      outputSchema,
    },
    async (args) => {
      try {
        return await runBalanceTool(args);
      } catch (error) {
        return mapDbError(error);
      }
    }
  );
}
