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
            description: 'How you will query (joins, aggregates, limit)',
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
        '**Present rows in chat UI (host).** Call once after Firebird **execute_sql** when you have the final answer. ' +
        'Pass rows from the final query only. UI shows ~8 business columns by default. ' +
        'Pass tableName for AT_RELATION_FIELDS labels; use columnLabels for computed SQL aliases.',
      parameters: {
        type: 'object',
        properties: {
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
            description: 'Row objects from execute_sql',
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
            description: 'Row count from SQL (defaults to rows.length)',
          },
          truncated: {
            type: 'boolean',
            description: 'True if execute_sql hit a row limit',
          },
        },
        required: ['rows'],
      },
    },
  },
];
