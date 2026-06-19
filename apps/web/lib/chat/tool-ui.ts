import { AgentToolName } from '@/lib/agent/tool-names';
import { isFirebirdTool } from './firebird-tools';

/** Host tools with dedicated UI blocks — no duplicate "Using:" panel. */
const HIDDEN_TOOL_CALL_PANEL = new Set<string>([
  AgentToolName.CreateQueryPlan,
  AgentToolName.PresentQueryResult,
]);

/** @deprecated Firebird MCP tools now use dedicated brief panels; kept for callers. */
export function isSilentFirebirdToolUi(_toolName: string): boolean {
  return false;
}

export function shouldShowToolCallPanel(toolName: string): boolean {
  if (HIDDEN_TOOL_CALL_PANEL.has(toolName)) {
    return false;
  }
  return true;
}

/** Whether a tool-panel message should appear in the chat list. */
export function isToolPanelVisible(
  toolName: string,
  developerMode: boolean
): boolean {
  if (!shouldShowToolCallPanel(toolName)) {
    return false;
  }
  if (isFirebirdTool(toolName)) {
    return developerMode; // TODO: Maybe it should be true for all tools in the future
  }
  return developerMode;
}

/** Collapsible "Using:" panels in chat (developer diagnostics). */
export function isToolCallPanelMessage(message: {
  toolName?: string;
}): boolean {
  return Boolean(message.toolName);
}
