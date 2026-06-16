import { AgentToolName } from '@/lib/agent/tool-names';

/** Host tools with dedicated UI blocks — no duplicate "Using:" panel. */
const HIDDEN_TOOL_CALL_PANEL = new Set<string>([
  AgentToolName.CreateQueryPlan,
  AgentToolName.PresentQueryResult,
]);

/** @deprecated Firebird MCP tools now use sanitized ToolCallPanel; kept for callers. */
export function isSilentFirebirdToolUi(_toolName: string): boolean {
  return false;
}

export function shouldShowToolCallPanel(toolName: string): boolean {
  if (HIDDEN_TOOL_CALL_PANEL.has(toolName)) {
    return false;
  }
  return true;
}

/** Collapsible "Using:" panels in chat (developer diagnostics). */
export function isToolCallPanelMessage(message: {
  toolName?: string;
}): boolean {
  return Boolean(message.toolName);
}
