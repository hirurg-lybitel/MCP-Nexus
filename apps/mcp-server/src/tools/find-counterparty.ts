import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { mapDbError, toolSuccess } from '../lib/tool-result.js';

const inputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe('Fragment of counterparty / contact name'),
  limit: z.number().int().min(1).max(100).optional().describe('Max rows (default 20)'),
});

const outputSchema = z.object({
  counterparties: z
    .array(
      z.object({
        id: z.union([z.number(), z.string()]),
        name: z.string(),
        contactType: z.union([z.number(), z.string(), z.null()]).optional(),
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

export function registerFindCounterpartyTool(server: McpServer): void {
  server.registerTool(
    'find_counterparty',
    {
      title: 'Find counterparty',
      description:
        'Search GD_CONTACT by name fragment (companies and people). ' +
        'When the user named an organization, call this first and pass the returned id as companyKey. ' +
        'Never invent companyKey (do not use 1 or 0). ' +
        'If the organization was not named, omit companyKey on accounting tools instead of guessing.',
      inputSchema,
      outputSchema,
    },
    async (args) => {
      const limit = args.limit ?? 20;
      const like = `%${esc(args.query.trim())}%`;
      try {
        const { requireDbServices } = await import('@mcp-nexus/db-firebird');
        const db = requireDbServices();
        const sql = `
SELECT FIRST ${limit}
  c.id,
  c.name,
  c.contacttype
FROM gd_contact c
WHERE UPPER(c.name) LIKE UPPER('${like}')
ORDER BY c.name`;

        const result = await db.executeSql.run(sql);
        const counterparties = result.rows.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            id: r.ID ?? r.id,
            name: String(r.NAME ?? r.name ?? ''),
            contactType: r.CONTACTTYPE ?? r.contacttype ?? null,
          };
        });
        return toolSuccess({ counterparties, rowCount: counterparties.length });
      } catch (error) {
        return mapDbError(error);
      }
    }
  );
}
