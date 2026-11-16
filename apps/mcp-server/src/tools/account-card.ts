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
  limit: z
    .number()
    .int()
    .min(1)
    .max(5000)
    .optional()
    .describe('Max rows returned to the model (default 500)'),
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
  entries: z.array(z.record(z.string(), z.unknown())).optional(),
  rowCount: z.number().optional(),
  truncated: z.boolean().optional(),
  dataCutoff: z.string().nullable().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

interface WorkerAccountCardRow {
  id?: number | string;
  entryDate?: string;
  alias?: string;
  corrAlias?: string;
  ncuDebit?: number | string;
  ncuCredit?: number | string;
  documentKey?: number | string;
  number?: string;
  documentName?: string;
  transactionName?: string;
  description?: string;
}

interface WorkerAccountCardResponse {
  ok?: boolean;
  truncated?: boolean;
  rowCount?: number;
  error?: string;
  message?: string;
  source?: string;
  rows?: WorkerAccountCardRow[];
}

export function registerAccountCardTool(server: McpServer): void {
  server.registerTool(
    'get_account_card',
    {
      title: 'Account card (карта счёта)',
      description:
        'Build the account card (карта счёта): entry-by-entry lines with documents for one account and period. ' +
        'Source: Gedemin worker TgdvAcctAccCard. Resolve accountKey via find_account first. ' +
        'Rows include accountName / corrAccountName from AC_ACCOUNT — use them, do not guess roles from alias digits. ' +
        'Omit companyKey when unnamed; when named, use find_counterparty — never invent. ' +
        'Do not rebuild the card with run_sql.',
      inputSchema,
      outputSchema,
    },
    async (args) => {
      const limit = args.limit ?? 500;

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
        const raw = (await client.getAccountCard({
          ...params,
          maxRows: limit,
        })) as WorkerAccountCardResponse;

        if (!raw || raw.ok === false) {
          return toolFailure(
            raw?.error || 'WORKER_REPORT_ERROR',
            raw?.message || raw?.error || 'Worker returned error'
          );
        }

        let nameIndex = {
          byAlias: new Map<string, string>(),
          byId: new Map(),
          offbalanceByAlias: new Map<string, number>(),
        };
        const chart = await resolveActiveChart(db, company.companyKey);
        if (chart.ok) {
          nameIndex = await loadAccountNameIndex(db, chart.accountKey);
        }

        const all = raw.rows ?? [];
        const truncated = Boolean(raw.truncated) || all.length > limit;
        const slice = all.length > limit ? all.slice(0, limit) : all;
        const entries = slice.map((row) => {
          const alias = row.alias ?? '';
          const corrAlias = row.corrAlias ?? '';
          return {
            id: row.id ?? null,
            entryDate: row.entryDate ?? '',
            alias,
            accountName: lookupAccountName(nameIndex, alias),
            corrAlias,
            corrAccountName: lookupAccountName(nameIndex, corrAlias),
            ncuDebit: formatMoney(row.ncuDebit),
            ncuCredit: formatMoney(row.ncuCredit),
            documentKey: row.documentKey ?? null,
            number: row.number ?? '',
            documentName: row.documentName ?? '',
            transactionName: row.transactionName ?? '',
            description: row.description ?? '',
          };
        });

        return toolSuccess({
          source: raw.source || 'tgdv_acct_acc_card',
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
          entries,
          rowCount: entries.length,
          truncated,
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
