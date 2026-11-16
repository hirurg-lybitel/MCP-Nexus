import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { mapDbError, toolSuccess } from '../lib/tool-result.js';

const inputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe('Fragment of item / service name (GD_GOOD.NAME)'),
  limit: z.number().int().min(1).max(100).optional().describe('Max rows (default 20)'),
});

const outputSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.union([z.number(), z.string()]),
        name: z.string(),
        groupKey: z.union([z.number(), z.string(), z.null()]).optional(),
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

export function registerFindItemTool(server: McpServer): void {
  server.registerTool(
    'find_item',
    {
      title: 'Find item (ТМЦ / услуга)',
      description:
        'Search GD_GOOD by name fragment. Returns id for use as analytics value or in document queries.',
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
  g.id,
  g.name,
  g.groupkey
FROM gd_good g
WHERE UPPER(g.name) LIKE UPPER('${like}')
ORDER BY g.name`;

        const result = await db.executeSql.run(sql);
        const items = result.rows.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            id: r.ID ?? r.id,
            name: String(r.NAME ?? r.name ?? ''),
            groupKey: r.GROUPKEY ?? r.groupkey ?? null,
          };
        });
        return toolSuccess({ items, rowCount: items.length });
      } catch (error) {
        return mapDbError(error);
      }
    }
  );
}
