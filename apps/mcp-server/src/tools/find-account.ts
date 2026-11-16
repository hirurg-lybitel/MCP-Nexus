import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { mapDbError, toolSuccess } from '../lib/tool-result.js';

const inputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe('Account alias or a fragment of the account name'),
  companyKey: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Working organization id from find_counterparty. When set, search only that organization’s active chart.'
    ),
  chartRootId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Chart root account id. When omitted, search every active chart (AC_COMPANYACCOUNT.ISACTIVE = 1).'
    ),
  limit: z.number().int().min(1).max(100).optional().describe('Max rows (default 20)'),
});

const outputSchema = z.object({
  accounts: z
    .array(
      z.object({
        id: z.union([z.number(), z.string()]),
        alias: z.string(),
        name: z.string(),
        accountType: z.string().optional(),
        parent: z.union([z.number(), z.string(), z.null()]).optional(),
        offbalance: z.union([z.number(), z.string()]).optional(),
      })
    )
    .optional(),
  rowCount: z.number().optional(),
  dataCutoff: z.string().nullable().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

function esc(literal: string): string {
  return literal.replace(/'/g, "''");
}

export function registerFindAccountTool(server: McpServer): void {
  server.registerTool(
    'find_account',
    {
      title: 'Find account',
      description:
        'Search accounts by alias or name inside the active chart of the connected database. ' +
        'Pass companyKey to limit the search to one organization. ' +
        'Returns id, alias, name for later accountKey arguments.',
      inputSchema,
      outputSchema,
    },
    async (args) => {
      const limit = args.limit ?? 20;
      const q = args.query.trim();
      const like = `%${esc(q)}%`;
      const companyFilter =
        args.companyKey != null ? `AND ca.companykey = ${args.companyKey}` : '';
      const chartScope =
        args.chartRootId != null
          ? `JOIN ac_account root ON root.id = ${args.chartRootId}
WHERE a.lb >= root.lb
  AND a.rb <= root.rb`
          : `WHERE EXISTS (
    SELECT 1
    FROM ac_companyaccount ca
    JOIN ac_account root ON root.id = ca.accountkey
    WHERE ca.isactive = 1
      ${companyFilter}
      AND a.lb >= root.lb
      AND a.rb <= root.rb
  )`;

      try {
        const { requireDbServices } = await import('@mcp-nexus/db-firebird');
        const db = requireDbServices();
        const sql = `
SELECT FIRST ${limit}
  a.id,
  a.alias,
  a.name,
  a.accounttype,
  a.parent,
  a.offbalance
FROM ac_account a
${chartScope}
  AND a.accounttype IN ('A', 'S')
  AND (
    UPPER(a.alias) STARTING WITH UPPER('${esc(q)}')
    OR UPPER(a.name) LIKE UPPER('${like}')
  )
ORDER BY a.alias`;

        const result = await db.executeSql.run(sql);
        const accounts = result.rows.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            id: r.ID ?? r.id,
            alias: String(r.ALIAS ?? r.alias ?? ''),
            name: String(r.NAME ?? r.name ?? ''),
            accountType: r.ACCOUNTTYPE ?? r.accounttype,
            parent: r.PARENT ?? r.parent ?? null,
            offbalance: r.OFFBALANCE ?? r.offbalance,
          };
        });

        return toolSuccess({
          accounts,
          rowCount: accounts.length,
        });
      } catch (error) {
        return mapDbError(error);
      }
    }
  );
}
