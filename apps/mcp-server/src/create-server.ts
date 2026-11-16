import { McpServer } from '@modelcontextprotocol/server';
import { SERVER_INSTRUCTIONS } from './instructions.js';
import { installToolAudit } from './lib/audit.js';
import { registerAccountCardTool } from './tools/account-card.js';
import { registerAccountReviewTool } from './tools/account-review.js';
import { registerAnalyticsBalanceTool } from './tools/analytics-balance.js';
import {
  registerAccountSaldoTool,
  registerBalanceTool,
} from './tools/balance.js';
import { registerChartOfAccountsTool } from './tools/chart-of-accounts.js';
import { registerJournalOrderTool } from './tools/journal-order.js';
import { registerFindAccountTool } from './tools/find-account.js';
import { registerFindAnalyticsValueTool } from './tools/find-analytics-value.js';
import { registerFindCounterpartyTool } from './tools/find-counterparty.js';
import { registerFindDocumentTypeTool } from './tools/find-document-type.js';
import { registerFindItemTool } from './tools/find-item.js';
import {
  registerGetDocumentTool,
  registerGetDocumentsTool,
} from './tools/get-documents.js';
import { registerReportConfigTools } from './tools/report-configs.js';
import { registerRunSqlTool } from './tools/run-sql.js';
import { registerTrialBalanceTool } from './tools/trial-balance.js';

export const SERVER_INFO = {
  name: 'mcp-nexus',
  version: '0.3.0',
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
      prompts: {},
      logging: {},
    },
  });

  installToolAudit(server);
  // Advertise prompts so clients get [] instead of Method not found (-32601).
  // Catalog prompts arrive in stage 4/5; until then the list is empty.

  registerRunSqlTool(server);
  registerChartOfAccountsTool(server);
  registerTrialBalanceTool(server);
  registerBalanceTool(server);
  registerAccountSaldoTool(server);
  registerAnalyticsBalanceTool(server);
  registerAccountCardTool(server);
  registerAccountReviewTool(server);
  registerJournalOrderTool(server);
  registerReportConfigTools(server);
  registerFindAccountTool(server);
  registerFindCounterpartyTool(server);
  registerFindDocumentTypeTool(server);
  registerFindItemTool(server);
  registerFindAnalyticsValueTool(server);
  registerGetDocumentsTool(server);
  registerGetDocumentTool(server);

  return server;
}
