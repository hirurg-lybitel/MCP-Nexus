import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import {
  getQueryTableUserMessage,
  LOCALE_ARG_SCHEMA,
} from '@/lib/i18n/mcp-prompts';

const DEFAULT_TABLE = 'GD_GOOD';
const DEFAULT_ROW_LIMIT = 10;
const MAX_ROW_LIMIT = 50;

const localeSchema = z.enum(LOCALE_ARG_SCHEMA).optional();

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
      argsSchema: {
        locale: localeSchema.describe('UI language for prompt text (en, ru, by)'),
      },
    },
    async (args): Promise<GetPromptResult> => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: getQueryTableUserMessage(
              args?.locale,
              DEFAULT_TABLE,
              DEFAULT_ROW_LIMIT
            ),
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
        locale: localeSchema.describe('UI language for prompt text (en, ru, by)'),
      },
    },
    async (args): Promise<GetPromptResult> => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: getQueryTableUserMessage(
              args.locale,
              args.tableName,
              parseRowLimit(args.limit)
            ),
          },
        },
      ],
    })
  );
}
