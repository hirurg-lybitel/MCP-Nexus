import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { resolveAccountKey } from '../lib/account-key.js';
import { resolveActiveChart } from '../lib/active-chart.js';
import {
  accountKeyParam,
  companyKeyParam,
  companyOutputFields,
  appliedFilters,
} from '../lib/report-params.js';
import { mapDbError, toolFailure, toolSuccess } from '../lib/tool-result.js';
import { resolveWorkingCompany } from '../lib/working-company.js';

const inputSchema = z.object({
  companyKey: companyKeyParam,
  accountKey: accountKeyParam
    .optional()
    .describe(
      'Branch root account id from find_account. When omitted, the active chart root of companyKey is used. Never pass an alias like 60/62.'
    ),
  depth: z
    .number()
    .int()
    .min(0)
    .max(20)
    .optional()
    .describe(
      'Max nesting depth from the branch root (0 = only the root). Omit for the full branch.'
    ),
  includeGroups: z
    .boolean()
    .optional()
    .describe('Include group nodes (accounttype F). Default false'),
  query: z
    .string()
    .optional()
    .describe('Optional alias/name fragment to filter accounts inside the branch'),
  limit: z.number().int().min(1).max(5000).optional().describe('Max rows (default 2000)'),
});

const outputSchema = z.object({
  companyKey: z.number().optional(),
  ...companyOutputFields,
  chartRootId: z.number().optional(),
  branchAccountKey: z.number().optional(),
  accounts: z.array(z.record(z.string(), z.unknown())).optional(),
  rowCount: z.number().optional(),
  appliedFilters: z.record(z.string(), z.unknown()).optional(),
  dataCutoff: z.string().nullable().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

function esc(literal: string): string {
  return literal.replace(/'/g, "''");
}

function activityLabel(code: unknown): string {
  const c = String(code ?? '').toUpperCase();
  if (c === 'A') return 'active';
  if (c === 'P') return 'passive';
  if (c === 'B') return 'active_passive';
  return c || 'unknown';
}

export function registerChartOfAccountsTool(server: McpServer): void {
  server.registerTool(
    'get_chart_of_accounts',
    {
      title: 'Chart of accounts',
      description:
        'Return the chart of accounts hierarchy for an organization: alias, name, type (C/F/A/S), ' +
        'activity (A/P/B), off-balance and multi-currency flags, and analytics fields from AC_ACCANALYTICSEXT. ' +
        'Omit companyKey when unnamed; when named, use find_counterparty — never invent companyKey. ' +
        'Use find_account for a quick search; use this tool to inspect a branch or the whole active chart.',
      inputSchema,
      outputSchema,
    },
    async (args) => {
      const limit = args.limit ?? 2000;
      const includeGroups = args.includeGroups ?? false;
      const types = includeGroups ? `'A','S','F','C'` : `'A','S','C'`;

      try {
        const { requireDbServices } = await import('@mcp-nexus/db-firebird');
        const db = requireDbServices();
        const company = await resolveWorkingCompany(db, args.companyKey);
        if (!company.ok) {
          return toolFailure(company.code, company.message, {
            ...(company.companies ? { companies: company.companies } : {}),
          });
        }

        let chartRootId: number | undefined;
        let branchKey = args.accountKey;
        if (branchKey == null) {
          const chart = await resolveActiveChart(db, company.companyKey);
          if (!chart.ok) return toolFailure(chart.code, chart.message);
          chartRootId = chart.accountKey;
          branchKey = chart.accountKey;
        } else {
          const account = await resolveAccountKey(db, branchKey);
          if (!account.ok) {
            return toolFailure(account.code, account.message);
          }
          branchKey = account.accountKey;
          const chart = await resolveActiveChart(db, company.companyKey);
          if (chart.ok) chartRootId = chart.accountKey;
        }

        const q = args.query?.trim();
        const queryFilter = q
          ? `AND (
    UPPER(a.alias) STARTING WITH UPPER('${esc(q)}')
    OR UPPER(a.name) LIKE UPPER('%${esc(q)}%')
  )`
          : '';

        // Depth is measured from the branch root. When searching by alias/name,
        // skip depth so deep matches like "62.1" are not filtered out.
        const depthFilter =
          args.depth == null || q
            ? ''
            : `AND (
    SELECT COUNT(*)
    FROM ac_account anc
    WHERE anc.lb <= a.lb AND anc.rb >= a.rb
      AND anc.lb >= root.lb AND anc.rb <= root.rb
      AND anc.id <> root.id
  ) <= ${args.depth}`;

        const sql = `
SELECT FIRST ${limit}
  a.id,
  a.alias,
  a.name,
  a.fullname,
  a.accounttype,
  a.activity,
  a.offbalance,
  a.multycurr,
  a.parent,
  a.lb,
  a.rb,
  (
    SELECT COUNT(*)
    FROM ac_account anc
    WHERE anc.lb <= a.lb AND anc.rb >= a.rb
      AND anc.lb >= root.lb AND anc.rb <= root.rb
      AND anc.id <> root.id
  ) AS depth
FROM ac_account a
JOIN ac_account root ON root.id = ${branchKey}
WHERE a.lb >= root.lb
  AND a.rb <= root.rb
  AND a.accounttype IN (${types})
  ${queryFilter}
  ${depthFilter}
ORDER BY a.lb`;

        const result = await db.executeSql.run(sql);
        const ids = result.rows
          .map((row) => {
            const r = row as Record<string, unknown>;
            return Number(r.ID ?? r.id);
          })
          .filter((id) => Number.isFinite(id) && id > 0);

        const analyticsByAccount = new Map<
          number,
          Array<{ fieldName: string; label: string }>
        >();
        if (ids.length > 0) {
          const idList = ids.slice(0, 2000).join(',');
          const anal = await db.executeSql.run(`
SELECT a.accountkey, f.fieldname, f.lname
FROM ac_accanalyticsext a
JOIN at_relation_fields f ON f.id = a.valuekey
WHERE a.accountkey IN (${idList})
ORDER BY a.accountkey, f.fieldname`);
          for (const row of anal.rows) {
            const r = row as Record<string, unknown>;
            const accountKey = Number(r.ACCOUNTKEY ?? r.accountkey);
            const fieldName = String(r.FIELDNAME ?? r.fieldname ?? '');
            const label = String(r.LNAME ?? r.lname ?? fieldName);
            if (!accountKey || !fieldName) continue;
            const list = analyticsByAccount.get(accountKey) ?? [];
            list.push({ fieldName, label });
            analyticsByAccount.set(accountKey, list);
          }
        }

        const accounts = result.rows.map((row) => {
          const r = row as Record<string, unknown>;
          const id = Number(r.ID ?? r.id);
          return {
            id,
            alias: String(r.ALIAS ?? r.alias ?? ''),
            name: String(r.NAME ?? r.name ?? ''),
            accountType: String(r.ACCOUNTTYPE ?? r.accounttype ?? ''),
            activity: String(r.ACTIVITY ?? r.activity ?? ''),
            activityKind: activityLabel(r.ACTIVITY ?? r.activity),
            offbalance: Number(r.OFFBALANCE ?? r.offbalance ?? 0),
            multycurr: Number(r.MULTYCURR ?? r.multycurr ?? 0),
            parent: r.PARENT ?? r.parent ?? null,
            depth: Number(r.DEPTH ?? r.depth ?? 0),
            analytics: analyticsByAccount.get(id) ?? [],
          };
        });

        return toolSuccess({
          companyKey: company.companyKey,
          companyName: company.companyName,
          companyScope: company.companyScope,
          chartRootId,
          branchAccountKey: branchKey,
          accounts,
          rowCount: accounts.length,
          appliedFilters: appliedFilters({
            companyKey: company.companyKey,
            companyName: company.companyName,
            companyScope: company.companyScope,
            accountKey: branchKey,
          }),
        });
      } catch (error) {
        return mapDbError(error);
      }
    }
  );
}
