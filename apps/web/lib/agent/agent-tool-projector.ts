import { summarizeQueryResult } from '@mcp-nexus/db-firebird/query-result-summary';
import { AgentToolName } from './tool-names';

export interface IAgentToolProjector {
  forModel(toolName: string, fullPayload: string): string;
}

function parsePayload(fullPayload: string): Record<string, unknown> | null {
  try {
    const data = JSON.parse(fullPayload) as unknown;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function slimDescribeTableColumns(
  columns: unknown
): Record<string, unknown>[] {
  if (!Array.isArray(columns)) {
    return [];
  }

  return columns
    .filter(
      (col): col is Record<string, unknown> =>
        col !== null && typeof col === 'object' && !Array.isArray(col)
    )
    .map((col) => {
      const slim: Record<string, unknown> = {
        fieldName: col.fieldName,
      };
      if (col.displayName != null && String(col.displayName).trim()) {
        slim.displayName = col.displayName;
      }
      if (col.sensitive === true) {
        slim.sensitive = true;
      }
      if (col.refTable != null && String(col.refTable).trim()) {
        slim.refTable = col.refTable;
      }
      return slim;
    });
}

export class AgentToolProjector implements IAgentToolProjector {
  forModel(toolName: string, fullPayload: string): string {
    if (fullPayload.trim().startsWith('{') && fullPayload.includes('"error"')) {
      return fullPayload;
    }

    const payload = parsePayload(fullPayload);
    if (!payload) {
      return fullPayload;
    }

    if (payload.error) {
      return fullPayload;
    }

    switch (toolName) {
    case 'execute_sql': {
      const rows = Array.isArray(payload.rows)
        ? (payload.rows as Record<string, unknown>[])
        : [];
      const rowCount =
        typeof payload.rowCount === 'number' ? payload.rowCount : rows.length;
      const truncated = Boolean(payload.truncated);
      return JSON.stringify(
        summarizeQueryResult(rows, rowCount, truncated)
      );
    }
    case 'describe_table':
      return JSON.stringify({
        tableName: payload.tableName,
        tableDisplayName: payload.tableDisplayName,
        columns: slimDescribeTableColumns(payload.columns),
      });
    case AgentToolName.PresentQueryResult:
      return JSON.stringify({
        presented: true,
        rowCount: payload.rowCount ?? null,
        title: payload.title ?? null,
        truncated: payload.truncated ?? false,
      });
    default:
      return fullPayload;
    }
  }
}

export const defaultAgentToolProjector = new AgentToolProjector();

export function projectToolResultForModel(
  toolName: string,
  fullPayload: string
): string {
  return defaultAgentToolProjector.forModel(toolName, fullPayload);
}
