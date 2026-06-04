import { AgentToolName } from './tool-names';

const MAX_PRESENT_ROWS = 500;

function toolErrorJson(message: string, code: string): string {
  return JSON.stringify({ error: message, code });
}

export async function executeAgentTool(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
  case AgentToolName.CreateQueryPlan:
    return executeCreateQueryPlan(toolInput);
  case AgentToolName.PresentQueryResult:
    return executePresentQueryResult(toolInput);
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
  input: Record<string, unknown>
): Promise<string> {
  const rows = input.rows;
  if (!Array.isArray(rows)) {
    return toolErrorJson('rows array is required', 'INVALID_PRESENT');
  }

  const rowObjects = rows.filter(
    (r) => r && typeof r === 'object' && !Array.isArray(r)
  ) as Record<string, unknown>[];

  const capped =
    rowObjects.length > MAX_PRESENT_ROWS
      ? rowObjects.slice(0, MAX_PRESENT_ROWS)
      : rowObjects;

  const body: Record<string, unknown> = {
    rows: capped,
    rowCount:
      typeof input.rowCount === 'number' ? input.rowCount : rowObjects.length,
    truncated:
      Boolean(input.truncated) || rowObjects.length > MAX_PRESENT_ROWS,
  };

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
    const response = await fetch('/api/agent/present-query-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
