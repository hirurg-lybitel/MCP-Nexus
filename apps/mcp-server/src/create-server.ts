import { McpServer } from '@modelcontextprotocol/server';
import { SERVER_INSTRUCTIONS } from './instructions.js';
import { registerRunSqlTool } from './tools/run-sql.js';
import { registerTrialBalanceTool } from './tools/trial-balance.js';

export const SERVER_INFO = {
  name: 'mcp-nexus',
  version: '0.2.0',
  title: 'MCP Nexus (Gedemin)',
  description:
    'Read-only MCP server for the Gedemin accounting platform on Firebird.',
} as const;

/** Fresh server instance for one stdio connection or one HTTP request. */
export function createServer(): McpServer {
  const server = new McpServer(SERVER_INFO, {
    instructions: SERVER_INSTRUCTIONS,
    capabilities: {
      tools: {},
      logging: {},
    },
  });

  registerRunSqlTool(server);
  registerTrialBalanceTool(server);

  return server;
}
