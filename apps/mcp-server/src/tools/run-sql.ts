import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { mapDbError, toolSuccess } from '../lib/tool-result.js';

const inputSchema = z.object({
  sql: z
    .string()
    .min(1)
    .describe('Read-only SQL (SELECT / WITH). Mutations are rejected.'),
});

const outputSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).optional(),
  rowCount: z.number().optional(),
  truncated: z.boolean().optional(),
  dataCutoff: z.string().nullable().optional(),
  // Present when isError — SDK validates structuredContent against this schema
  error: z.string().optional(),
  code: z.string().optional(),
});

export function registerRunSqlTool(server: McpServer): void {
  server.registerTool(
    'run_sql',
    {
      title: 'Run read-only SQL',
      description:
        'Execute a read-only SQL query against the Firebird database. ' +
        'Only SELECT / WITH are allowed. Prefer accounting tools (get_trial_balance) for trial balance and similar reports. ' +
        'Sensitive columns are redacted. Row count is limited by FIREBIRD_MAX_ROWS.',
      inputSchema,
      outputSchema,
    },
    async ({ sql }) => {
      try {
        const { requireDbServices } = await import('@mcp-nexus/db-firebird');
        const db = requireDbServices();
        const result = await db.runValidatedQuery.run(sql);
        return toolSuccess({
          rows: result.rows,
          rowCount: result.rowCount,
          truncated: result.truncated,
        });
      } catch (error) {
        return mapDbError(error);
      }
    }
  );
}
