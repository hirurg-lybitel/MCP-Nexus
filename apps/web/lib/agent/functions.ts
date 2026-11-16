import type { ChatCompletionFunctionTool } from 'openai/resources';
import { AgentToolName } from './tool-names';

/** Local agent tools (UI + orchestration). Not registered on the Firebird MCP server. */
export const AgentFunctions: Array<ChatCompletionFunctionTool> = [
  {
    type: 'function',
    function: {
      name: AgentToolName.CreateQueryPlan,
      description:
        '**Plan mode (read-only, host UI).** Call FIRST for non-trivial data questions before Firebird MCP tools. ' +
        'Summarize discovery steps (search_tables, describe_table), real table names, and SQL strategy. ' +
        'Never invent table names (e.g. GD_GROUP). Shown to the user as To-dos.',
      parameters: {
        type: 'object',
        properties: {
          userIntent: {
            type: 'string',
            description: 'What the user asked for',
          },
          summary: {
            type: 'string',
            description: 'One-paragraph plan summary',
          },
          discoverySteps: {
            type: 'array',
            description: 'Steps: which MCP tools to run and why',
            items: {
              type: 'object',
              properties: {
                phase: {
                  type: 'string',
                  enum: ['discovery', 'query', 'present'],
                },
                tool: {
                  type: 'string',
                  description: 'MCP tool name for this step, if applicable',
                },
                description: { type: 'string' },
              },
              required: ['phase', 'description'],
            },
          },
          tables: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tableName: { type: 'string' },
                displayName: { type: 'string' },
                role: { type: 'string' },
              },
              required: ['tableName', 'role'],
            },
          },
          sqlStrategy: {
            type: 'string',
            description:
              'How you will query (joins, aggregates, SELECT FIRST / OFFSET FETCH). ' +
              'Firebird 5: WITH / windows / RECURSIVE allowed when useful; do not use LIMIT. ' +
              'Do not add row-number columns unless needed — the UI may prepend № automatically.',
          },
          notes: { type: 'string' },
        },
        required: ['userIntent', 'summary', 'discoverySteps', 'tables', 'sqlStrategy'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: AgentToolName.PresentQueryResult,
      description:
        '**Present rows in chat UI (host).** Two modes: (1) after **execute_sql** / **run_sql** pass the **same sql** (and params) — server re-runs for the UI; ' +
        '(2) pass **rows** (object array) + title when showing a curated table from an accounting tool. ' +
        'Accounting tools often auto-render their own UI table — use this for a filtered subset only. ' +
        'Pass tableName for AT_RELATION_FIELDS labels; use columnLabels for aliases. ' +
        'The UI adds a № column — do not include ROW_NUMBER in SQL.',
      parameters: {
        type: 'object',
        properties: {
          sql: {
            type: 'string',
            description:
              'Final read-only SELECT/WITH — same SQL passed to execute_sql / run_sql',
          },
          params: {
            type: 'object',
            description: 'Named SQL parameters, same as execute_sql',
            additionalProperties: true,
          },
          title: {
            type: 'string',
            description: 'Short title; defaults from AT_RELATIONS when tableName is set',
          },
          tableName: {
            type: 'string',
            description: 'Firebird table for label lookup (e.g. GD_GOOD)',
          },
          rows: {
            type: 'array',
            description:
              'Row objects for UI table when not using sql (accounting curated subset)',
            items: { type: 'object' },
          },
          columnLabels: {
            type: 'object',
            description:
              'Map of SQL field → column title for computed aliases',
            additionalProperties: { type: 'string' },
          },
          rowCount: {
            type: 'number',
            description: 'Optional when using rows; taken from query when using sql',
          },
          truncated: {
            type: 'boolean',
            description: 'Optional when using rows; taken from query when using sql',
          },
        },
      },
    },
  },
];
