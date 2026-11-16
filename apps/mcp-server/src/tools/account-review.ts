import type { McpServer } from '@modelcontextprotocol/server';
import {
  loadReportWorkerConfig,
  ReportWorkerClient,
  ReportWorkerError,
} from '@mcp-nexus/report-worker';
import * as z from 'zod/v4';
import { resolveAccountKey } from '../lib/account-key.js';
import {
  loadAccountNameIndex,
  lookupAccountName,
} from '../lib/account-names.js';
import { resolveActiveChart } from '../lib/active-chart.js';
import { formatMoney } from '../lib/money.js';
import {
  accountKeyParam,
  allHoldingCompaniesParam,
  appliedFilters,
  companyKeyParam,
  companyOutputFields,
  includeInternalParam,
  isoDateParam,
  relatedSiblingAccountSchema,
  withSubAccountsParam,
} from '../lib/report-params.js';
import { findRelatedSiblingAccounts } from '../lib/sibling-accounts.js';
import { splitSignedSaldo, sumTurnover } from '../lib/signed-saldo.js';
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
  /** Collapsed signed saldo (+debit / −credit). Prefer Debit/Credit fields. */
  saldoBeginNcu: z.string().optional(),
  saldoEndNcu: z.string().optional(),
  saldoBeginDebitNcu: z.string().optional(),
  saldoBeginCreditNcu: z.string().optional(),
  saldoEndDebitNcu: z.string().optional(),
  saldoEndCreditNcu: z.string().optional(),
  turnoverDebitNcu: z.string().optional(),
  turnoverCreditNcu: z.string().optional(),
  accountAlias: z.string().optional(),
  accountName: z.string().optional(),
  relatedSiblingAccounts: z.array(relatedSiblingAccountSchema).optional(),
  rows: z.array(z.record(z.string(), z.unknown())).optional(),
  rowCount: z.number().optional(),
  dataCutoff: z.string().nullable().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

interface WorkerReviewRow {
  alias?: string;
  corrAlias?: string;
  ncuDebit?: number | string;
  ncuCredit?: number | string;
}

interface WorkerReviewResponse {
  ok?: boolean;
  error?: string;
  message?: string;
  source?: string;
  saldoBeginNcu?: number | string;
  saldoEndNcu?: number | string;
  rows?: WorkerReviewRow[];
}

export function registerAccountReviewTool(server: McpServer): void {
  server.registerTool(
    'get_account_analysis',
    {
      title: 'Account analysis (анализ счёта)',
      description:
        'Account analysis (анализ счёта): period turnovers by correspondent account plus collapsed opening/closing saldo. ' +
        'Source: Gedemin worker TgdvAcctAccReview. Resolve accountKey via find_account. ' +
        'Use for correspondent turnovers over a period — NOT for debt/overpayment/DZ/KZ on a date (use get_balance; read totals.debitNcu and totals.creditNcu). ' +
        'saldo*DebitNcu / saldo*CreditNcu are collapsed sides without analytics (+ was debit, − was credit); turnover*Ncu sums row NCU. ' +
        'Always read accountName / corrAccountName — never map 90.* aliases to revenue/cost/profit by code digits alone. ' +
        'When relatedSiblingAccounts is non-empty, those A/S nodes share the prefix but sit outside LB/RB — include them with separate calls. ' +
        'Omit companyKey when unnamed; when named, use find_counterparty — never invent. ' +
        'For entry-by-entry lines use get_account_card.',
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

        const config = loadReportWorkerConfig();
        if (!config) {
          return toolFailure(
            'WORKER_NOT_CONFIGURED',
            'GEDEMIN_WORKER_USER / GEDEMIN_WORKER_PASSWORD not set'
          );
        }

        const client = new ReportWorkerClient(config);
        const raw = (await client.getAccountReview(
          params
        )) as WorkerReviewResponse;

        if (!raw || raw.ok === false) {
          return toolFailure(
            raw?.error || 'WORKER_REPORT_ERROR',
            raw?.message || raw?.error || 'Worker returned error'
          );
        }

        let relatedSiblingAccounts: Array<{
          accountKey: number;
          alias: string;
          name: string;
          accountType: string;
        }> = [];
        let nameIndex = {
          byAlias: new Map<string, string>(),
          byId: new Map(),
          offbalanceByAlias: new Map<string, number>(),
        };
        const chart = await resolveActiveChart(db, company.companyKey);
        if (chart.ok) {
          nameIndex = await loadAccountNameIndex(db, chart.accountKey);
          relatedSiblingAccounts = await findRelatedSiblingAccounts(db, {
            accountKey: params.accountKey,
            chartRootId: chart.accountKey,
            alias: account.alias,
          });
        }

        const rows = (raw.rows ?? []).map((row) => {
          const alias = row.alias ?? '';
          const corrAlias = row.corrAlias ?? '';
          return {
            alias,
            accountName: lookupAccountName(nameIndex, alias),
            corrAlias,
            corrAccountName: lookupAccountName(nameIndex, corrAlias),
            ncuDebit: formatMoney(row.ncuDebit),
            ncuCredit: formatMoney(row.ncuCredit),
          };
        });
        const begin = splitSignedSaldo(raw.saldoBeginNcu);
        const end = splitSignedSaldo(raw.saldoEndNcu);
        const turnover = sumTurnover(rows);

        return toolSuccess({
          source: raw.source || 'tgdv_acct_acc_review',
          companyKey: params.companyKey,
          companyName: company.companyName,
          companyScope: company.companyScope,
          accountKey: params.accountKey,
          accountAlias: account.alias,
          accountName: account.name,
          dateBegin: params.dateBegin,
          dateEnd: params.dateEnd,
          includeInternal: params.includeInternal,
          withSubAccounts: params.withSubAccounts,
          allHoldingCompanies: params.allHoldingCompanies,
          appliedFilters: appliedFilters(filterMeta),
          saldoBeginNcu: begin.signed,
          saldoEndNcu: end.signed,
          saldoBeginDebitNcu: begin.debit,
          saldoBeginCreditNcu: begin.credit,
          saldoEndDebitNcu: end.debit,
          saldoEndCreditNcu: end.credit,
          turnoverDebitNcu: turnover.turnoverDebitNcu,
          turnoverCreditNcu: turnover.turnoverCreditNcu,
          relatedSiblingAccounts,
          rows,
          rowCount: rows.length,
        });
      } catch (error) {
        if (error instanceof ReportWorkerError) {
          return toolFailure(error.code, error.message);
        }
        return mapDbError(error);
      }
    }
  );
}
