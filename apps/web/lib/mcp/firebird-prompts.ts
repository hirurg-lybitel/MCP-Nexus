import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

const DEFAULT_TABLE = 'GD_GOOD';
const DEFAULT_ROW_LIMIT = 10;
const MAX_ROW_LIMIT = 50;

function parseRowLimit(raw: string | undefined): number {
  if (!raw?.trim()) {
    return DEFAULT_ROW_LIMIT;
  }
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return DEFAULT_ROW_LIMIT;
  }
  return Math.min(n, MAX_ROW_LIMIT);
}

function buildQueryTableUserMessage(tableName: string, limit: number): string {
  const table = tableName.trim().toUpperCase();
  return (
    `Покажи топ 7 групп товаров, включая количество товаров в каждой группе. ` +
    `Таккже добавь вычисляемое поле: процент товаров в каждой группе относительно общего количества товаров в этих группах.`
  );
}

/**
 * Default slash-command prompt for a small tabular Firebird sample (like get_temperature_prompt).
 */
export function registerFirebirdPrompts(server: McpServer): void {
  server.registerPrompt(
    'query_table_rows_prompt',
    {
      title: 'Query table rows (sample)',
      description:
        'Default prompt: fetch a small row sample from a Firebird table for UI table display',
    },
    async (): Promise<GetPromptResult> => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: buildQueryTableUserMessage(DEFAULT_TABLE, DEFAULT_ROW_LIMIT),
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'query_table_rows',
    {
      title: 'Query table rows',
      description:
        'Fetch a limited row sample from any Firebird table (rendered as UI table)',
      argsSchema: {
        tableName: z
          .string()
          .describe('Firebird table name, e.g. GD_GOOD, GD_UNIT'),
        limit: z
          .string()
          .optional()
          .describe(`Max rows to fetch (default ${DEFAULT_ROW_LIMIT}, max ${MAX_ROW_LIMIT})`),
      },
    },
    async (args): Promise<GetPromptResult> => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: buildQueryTableUserMessage(
              args.tableName,
              parseRowLimit(args.limit)
            ),
          },
        },
      ],
    })
  );
}
