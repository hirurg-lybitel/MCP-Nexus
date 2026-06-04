import { AgentToolName } from '@/lib/agent/tool-names';

/** Firebird MCP: no chat data table — only collapsible "Using:" panel + model context. */
const FIREBIRD_MCP_SILENT_UI = new Set([
  'search_tables',
  'list_tables',
  'describe_table',
  'execute_sql',
]);

/** Host tools with dedicated UI blocks — no duplicate "Using:" panel. */
const HIDDEN_TOOL_CALL_PANEL = new Set<string>([
  AgentToolName.CreateQueryPlan,
  AgentToolName.PresentQueryResult,
]);

export function isSilentFirebirdToolUi(toolName: string): boolean {
  return FIREBIRD_MCP_SILENT_UI.has(toolName);
}

export function shouldShowToolCallPanel(toolName: string): boolean {
  return !HIDDEN_TOOL_CALL_PANEL.has(toolName);
}
