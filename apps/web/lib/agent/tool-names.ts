/** Host-only tools (MCP-Nexus web agent). Not exposed on the Firebird MCP server. */
export enum AgentToolName {
  CreateQueryPlan = 'create_query_plan',
  PresentQueryResult = 'present_query_result',
}

const AGENT_TOOL_SET = new Set<string>(Object.values(AgentToolName));

export function isAgentTool(toolName: string): boolean {
  return AGENT_TOOL_SET.has(toolName);
}
