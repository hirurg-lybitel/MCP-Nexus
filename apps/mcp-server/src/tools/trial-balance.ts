import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { mapDbError, toolFailure, toolSuccess } from '../lib/tool-result.js';

const DEFAULT_CHART_ROOT = 300001;

const inputSchema = z.object({
  companyKey: z
    .number()
    .int()
    .positive()
    .describe('Organization id (GD_COMPANY / contact id), e.g. 146866007'),
  dateBegin: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('Period start, YYYY-MM-DD'),
  dateEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('Period end, YYYY-MM-DD'),
  accountKey: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(`Root account of the chart (default ${DEFAULT_CHART_ROOT})`),
  includeInternal: z
    .boolean()
    .optional()
    .describe('Include internal entries (DONTINMOVE=0). Default false'),
  allHoldingCompanies: z
    .boolean()
    .optional()
    .describe('Include holding companies. Default false'),
});

const outputSchema = z.object({
  source: z.string(),
  companyKey: z.number(),
  dateBegin: z.string(),
  dateEnd: z.string(),
  accountKey: z.number(),
  includeInternal: z.boolean(),
  allHoldingCompanies: z.boolean(),
  accounts: z.array(z.record(z.string(), z.unknown())),
  totals: z.record(z.string(), z.unknown()),
  rowCount: z.number(),
});

function money(value: unknown): string {
  if (value == null) return '0';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(4).replace(/\.?0+$/, (m) => (m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m));
  }
  if (typeof value === 'bigint') return value.toString();
  return String(value);
}

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
      out[key] = money(value);
    } else if (typeof value === 'bigint') {
      out[key] = value.toString();
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function registerTrialBalanceTool(server: McpServer): void {
  server.registerTool(
    'get_trial_balance',
    {
      title: 'Trial balance (ОСВ)',
      description:
        'Build the trial balance (оборотно-сальдовая ведомость) for a company and period. ' +
        'Stage 0 uses the Firebird procedure AC_CIRCULATIONLIST_BAL (same numbers as verification against the screen report). ' +
        'The Gedemin HTTP worker will replace this source later without changing the tool contract. ' +
        'Do not recompute trial balance with run_sql.',
      inputSchema,
      outputSchema,
    },
    async (args) => {
      const companyKey = args.companyKey;
      const dateBegin = args.dateBegin;
      const dateEnd = args.dateEnd;
      const accountKey = args.accountKey ?? DEFAULT_CHART_ROOT;
      const includeInternal = args.includeInternal ?? false;
      const allHoldingCompanies = args.allHoldingCompanies ?? false;
      const dontInMove = includeInternal ? 0 : 1;
      const allHolding = allHoldingCompanies ? 1 : 0;

      try {
        const { requireDbServices } = await import('@mcp-nexus/db-firebird');
        const db = requireDbServices();
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
  DATE '${dateBegin}',
  DATE '${dateEnd}',
  ${companyKey},
  ${allHolding},
  ${accountKey},
  0,
  ${dontInMove}
)
ORDER BY 1`;

        // Controlled SQL (zod-validated params only) — bypass table-name discovery
        // so procedure AC_CIRCULATIONLIST_BAL is not mistaken for an unknown table.
        const result = await db.executeSql.run(sql);
        const accounts = result.rows.map((row) =>
          normalizeRow(row as Record<string, unknown>)
        );

        const sum = (field: string) =>
          money(
            accounts.reduce((acc, row) => {
              const n = Number.parseFloat(String(row[field] ?? '0'));
              return acc + (Number.isFinite(n) ? n : 0);
            }, 0)
          );

        return toolSuccess({
          source: 'ac_circulationlist_bal',
          companyKey,
          dateBegin,
          dateEnd,
          accountKey,
          includeInternal,
          allHoldingCompanies,
          accounts,
          totals: {
            begin_debit: sum('BEGIN_DEBIT'),
            begin_credit: sum('BEGIN_CREDIT'),
            debit: sum('DEBIT'),
            credit: sum('CREDIT'),
            end_debit: sum('END_DEBIT'),
            end_credit: sum('END_CREDIT'),
            account_count: accounts.length,
          },
          rowCount: accounts.length,
        });
      } catch (error) {
        if (error instanceof Error && /WORKER/i.test(error.message)) {
          return toolFailure('WORKER_NOT_CONFIGURED', error.message);
        }
        return mapDbError(error);
      }
    }
  );
}
