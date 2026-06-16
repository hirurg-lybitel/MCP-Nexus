import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  FirebirdConfigError,
  FirebirdQueryError,
  ReadOnlySqlError,
  SensitiveColumnError,
  UnknownTablesError,
  requireDbServices,
} from '@mcp-nexus/db-firebird';
import {
  describeTableOutputSchema,
  executeSqlOutputSchema,
  firebirdToolSuccess,
  listTablesOutputSchema,
  searchTablesOutputSchema,
} from './firebird-schemas';

function toolErrorText(error: unknown): string {
  if (error instanceof FirebirdConfigError) {
    return JSON.stringify({ error: error.message, code: 'FIREBIRD_NOT_CONFIGURED' });
  }
  if (error instanceof ReadOnlySqlError) {
    return JSON.stringify({ error: error.message, code: 'READ_ONLY_SQL' });
  }
  if (error instanceof SensitiveColumnError) {
    return JSON.stringify({ error: error.message, code: 'SENSITIVE_COLUMN' });
  }
  if (error instanceof FirebirdQueryError) {
    return JSON.stringify({ error: error.message, code: 'QUERY_ERROR' });
  }
  if (error instanceof Error) {
    return JSON.stringify({ error: error.message, code: 'UNKNOWN' });
  }
  return JSON.stringify({ error: String(error), code: 'UNKNOWN' });
}

export function registerFirebirdTools(server: McpServer): void {
  server.registerTool(
    'search_tables',
    {
      description:
        'Search Gedemin AT_RELATIONS by Russian/English title or table name (e.g. "групп", "товар", GD_GOOD). ' +
        'Use to find the correct table before JOINs — never guess GD_* names. Not shown as UI table.',
      inputSchema: {
        query: z
          .string()
          .describe('Keywords: display name fragment or table name part'),
        limit: z
          .number()
          .optional()
          .describe('Max results (default 30)'),
      },
      outputSchema: searchTablesOutputSchema,
    },
    async ({ query, limit }) => {
      try {
        const db = requireDbServices();
        const tables = await db.searchTables.run(query, limit);
        return firebirdToolSuccess({ query: query.trim(), tables });
      } catch (error) {
        return {
          content: [{ type: 'text', text: toolErrorText(error) }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'list_tables',
    {
      description:
        'List user tables (RDB$RELATIONS) with localized titles from Gedemin AT_RELATIONS (LNAME). ' +
        'For discovery only — not shown in the chat UI; do not paste the full list in your reply.',
      inputSchema: {},
      outputSchema: listTablesOutputSchema,
    },
    async () => {
      try {
        const db = requireDbServices();
        const tables = await db.listTables.run();
        return firebirdToolSuccess({ tables });
      } catch (error) {
        return {
          content: [{ type: 'text', text: toolErrorText(error) }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'describe_table',
    {
      description:
        'Describe table columns: types (RDB$), displayName, and refTable/refListField for foreign keys (AT_FIELDS). ' +
        'Follow refTable for JOINs (e.g. GROUPKEY → GD_GOODGROUP). Not shown in the chat UI.',
      inputSchema: {
        tableName: z.string().describe('Table name, e.g. GD_UNIT'),
      },
      outputSchema: describeTableOutputSchema,
    },
    async ({ tableName }) => {
      try {
        const db = requireDbServices();
        const described = await db.describeTable.run(tableName);
        return firebirdToolSuccess({
          tableName: described.tableName,
          tableDisplayName: described.tableDisplayName ?? undefined,
          columns: described.columns,
        });
      } catch (error) {
        return {
          content: [{ type: 'text', text: toolErrorText(error) }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'execute_sql',
    {
      description:
        'Execute a read-only SQL query (SELECT or WITH). Never use SELECT * — list only columns needed for the question. ' +
        'Sensitive columns (PASSW, PASSWORD, TOKEN, …) are blocked or redacted server-side. ' +
        'Optional named params as :NAME in params. Result is for the model only (not shown in chat). ' +
        'After the final query, call the host tool **present_query_result** with the same **sql** (and tableName) — do not copy row values (MCP-Nexus web agent only).',
      inputSchema: {
        sql: z.string().describe('Read-only SQL (SELECT or WITH only)'),
        params: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Named parameters, e.g. { "ID": 1 } for :ID'),
      },
      outputSchema: executeSqlOutputSchema,
    },
    async ({ sql, params }) => {
      try {
        const db = requireDbServices();
        const result = await db.runValidatedQuery.run(sql, params);
        return firebirdToolSuccess({
          rows: result.rows,
          rowCount: result.rowCount,
          truncated: result.truncated,
        });
      } catch (error) {
        if (error instanceof UnknownTablesError) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: error.message,
                  code: 'UNKNOWN_TABLE',
                  unknownTables: error.unknownTables,
                  referencedTables: error.referencedTables,
                }),
              },
            ],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text', text: toolErrorText(error) }],
          isError: true,
        };
      }
    }
  );
}
