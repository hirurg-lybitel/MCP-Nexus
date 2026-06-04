import { AgentToolName } from '@/lib/agent/tool-names';
import type { QueryPlanData, QueryPlanStepStatus } from '@/types';
import { initPlanStepStatuses } from './plan-progress';

export const AGENT_PLAN_TOOL = AgentToolName.CreateQueryPlan;

export function parseQueryPlanFromToolResult(
  toolName: string,
  resultText: string
): QueryPlanData | null {
  if (toolName !== AGENT_PLAN_TOOL) {
    return null;
  }

  let data: unknown;
  try {
    data = JSON.parse(resultText);
  } catch {
    return null;
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }

  const record = data as Record<string, unknown>;
  if (record.error || typeof record.summary !== 'string') {
    return null;
  }

  const discoverySteps = Array.isArray(record.discoverySteps)
    ? record.discoverySteps
      .filter((s) => s && typeof s === 'object')
      .map((s) => {
        const step = s as Record<string, unknown>;
        return {
          phase: normalizePhase(step.phase),
          tool: typeof step.tool === 'string' ? step.tool : undefined,
          description: String(step.description ?? ''),
          status: 'pending' as QueryPlanStepStatus,
        };
      })
    : [];

  const tables = Array.isArray(record.tables)
    ? record.tables
      .filter((t) => t && typeof t === 'object')
      .map((t) => {
        const row = t as Record<string, unknown>;
        return {
          tableName: String(row.tableName ?? ''),
          displayName:
              typeof row.displayName === 'string'
                ? row.displayName
                : undefined,
          role: String(row.role ?? ''),
        };
      })
      .filter((t) => t.tableName)
    : [];

  return initPlanStepStatuses({
    userIntent: String(record.userIntent ?? ''),
    summary: record.summary,
    discoverySteps,
    tables,
    sqlStrategy: String(record.sqlStrategy ?? ''),
    notes:
      typeof record.notes === 'string' && record.notes.trim()
        ? record.notes.trim()
        : undefined,
  });
}

function normalizePhase(
  value: unknown
): QueryPlanData['discoverySteps'][0]['phase'] {
  if (value === 'discovery' || value === 'query' || value === 'present') {
    return value;
  }
  return 'discovery';
}
