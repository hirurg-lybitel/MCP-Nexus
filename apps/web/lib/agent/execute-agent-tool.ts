import { AgentToolName } from './tool-names';

function toolErrorJson(message: string, code: string): string {
  return JSON.stringify({ error: message, code });
}

export async function executeAgentTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  options?: { mcpAuthToken?: string }
): Promise<string> {
  switch (toolName) {
  case AgentToolName.CreateQueryPlan:
    return executeCreateQueryPlan(toolInput);
  case AgentToolName.PresentQueryResult:
    return executePresentQueryResult(toolInput, options?.mcpAuthToken);
  default:
    throw new Error(`Unknown agent tool: ${toolName}`);
  }
}

function executeCreateQueryPlan(input: Record<string, unknown>): string {
  const summary = input.summary;
  if (typeof summary !== 'string' || !summary.trim()) {
    return toolErrorJson('summary is required', 'INVALID_PLAN');
  }

  const discoverySteps = Array.isArray(input.discoverySteps)
    ? input.discoverySteps
    : [];
  const tables = Array.isArray(input.tables) ? input.tables : [];

  return JSON.stringify({
    userIntent: String(input.userIntent ?? ''),
    summary: summary.trim(),
    discoverySteps,
    tables,
    sqlStrategy: String(input.sqlStrategy ?? ''),
    notes:
      typeof input.notes === 'string' && input.notes.trim()
        ? input.notes.trim()
        : undefined,
  });
}

async function executePresentQueryResult(
  input: Record<string, unknown>,
  mcpAuthToken?: string
): Promise<string> {
  const sql = typeof input.sql === 'string' ? input.sql.trim() : '';
  const hasRows = Array.isArray(input.rows);

  if (!sql && !hasRows) {
    return toolErrorJson(
      'sql is required (pass the same SQL as execute_sql)',
      'INVALID_PRESENT'
    );
  }

  const body: Record<string, unknown> = {};

  if (sql) {
    body.sql = sql;
    if (
      input.params &&
      typeof input.params === 'object' &&
      !Array.isArray(input.params)
    ) {
      body.params = input.params;
    }
  } else if (hasRows) {
    const rowArray = input.rows as unknown[];
    body.rows = input.rows;
    body.rowCount =
      typeof input.rowCount === 'number' ? input.rowCount : rowArray.length;
    body.truncated = Boolean(input.truncated);
  }

  if (typeof input.title === 'string' && input.title.trim()) {
    body.title = input.title.trim();
  }
  if (typeof input.tableName === 'string' && input.tableName.trim()) {
    body.tableName = input.tableName.trim();
  }
  if (
    input.columnLabels &&
    typeof input.columnLabels === 'object' &&
    !Array.isArray(input.columnLabels)
  ) {
    body.columnLabels = input.columnLabels;
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (mcpAuthToken) {
      headers.Authorization = `Bearer ${mcpAuthToken}`;
    }

    const response = await fetch('/api/agent/present-query-result', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      return text.trim() || toolErrorJson('Present API failed', 'PRESENT_API');
    }
    return text;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    return toolErrorJson(`Present API failed. ${message}`, 'PRESENT_API');
  }
}
