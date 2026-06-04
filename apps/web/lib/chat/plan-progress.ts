import type { QueryPlanData, QueryPlanStep } from '@/types';

export type QueryPlanStepStatus = 'pending' | 'running' | 'completed';

const TOOL_ORDER = [
  'create_query_plan',
  'search_tables',
  'list_tables',
  'describe_table',
  'execute_sql',
  'present_query_result',
] as const;

/** Plan steps may use `functions.search_tables`; runtime tool names are `search_tables`. */
function normalizeToolName(tool?: string): string {
  const raw = tool?.trim().toLowerCase() ?? '';
  return raw.replace(/^functions\./, '');
}

function stepIndexForTool(
  steps: QueryPlanStep[],
  toolName: string,
  preferStatus: QueryPlanStepStatus
): number {
  const normalized = toolName.toLowerCase();

  const byTool = steps.findIndex(
    (s) =>
      normalizeToolName(s.tool) === normalized &&
      (s.status ?? 'pending') === preferStatus
  );
  if (byTool >= 0) {
    return byTool;
  }

  const byToolAny = steps.findIndex(
    (s) => normalizeToolName(s.tool) === normalized
  );
  if (byToolAny >= 0 && (steps[byToolAny].status ?? 'pending') === preferStatus) {
    return byToolAny;
  }

  const toolRank = TOOL_ORDER.indexOf(
    normalized as (typeof TOOL_ORDER)[number]
  );
  if (toolRank < 0) {
    return -1;
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepTool = normalizeToolName(step.tool);
    const stepRank = TOOL_ORDER.indexOf(
      stepTool as (typeof TOOL_ORDER)[number]
    );
    if (
      stepRank === toolRank &&
      (step.status ?? 'pending') === preferStatus
    ) {
      return i;
    }
  }

  return -1;
}

function withStepStatuses(
  steps: QueryPlanStep[],
  updater: (steps: QueryPlanStep[]) => QueryPlanStep[]
): QueryPlanStep[] {
  return updater(steps.map((s) => ({ ...s, status: s.status ?? 'pending' })));
}

export function initPlanStepStatuses(plan: QueryPlanData): QueryPlanData {
  return {
    ...plan,
    discoverySteps: plan.discoverySteps.map((s) => ({
      ...s,
      status: 'pending' as const,
    })),
  };
}

export function markPlanStepRunning(
  plan: QueryPlanData,
  toolName: string
): QueryPlanData {
  if (toolName === 'create_query_plan') {
    return plan;
  }

  const idx = stepIndexForTool(plan.discoverySteps, toolName, 'pending');
  if (idx < 0) {
    return plan;
  }

  const steps = withStepStatuses(plan.discoverySteps, (list) => {
    const next = list.map((s, i) => {
      if (i < idx && s.status !== 'completed') {
        return { ...s, status: 'completed' as const };
      }
      if (i === idx) {
        return { ...s, status: 'running' as const };
      }
      return s;
    });
    return next;
  });

  return { ...plan, discoverySteps: steps };
}

export function markPlanStepCompleted(
  plan: QueryPlanData,
  toolName: string
): QueryPlanData {
  if (toolName === 'create_query_plan') {
    return plan;
  }

  const idx = stepIndexForTool(plan.discoverySteps, toolName, 'running');
  const fallbackIdx =
    idx >= 0
      ? idx
      : stepIndexForTool(plan.discoverySteps, toolName, 'pending');

  if (fallbackIdx < 0) {
    return plan;
  }

  const steps = plan.discoverySteps.map((s, i) =>
    i === fallbackIdx ? { ...s, status: 'completed' as const } : s
  );

  return { ...plan, discoverySteps: steps };
}

export function markAllPlanStepsCompleted(plan: QueryPlanData): QueryPlanData {
  return {
    ...plan,
    discoverySteps: plan.discoverySteps.map((s) => ({
      ...s,
      status: 'completed' as const,
    })),
  };
}

export function updateActivePlanInMessages(
  messages: Array<{ id: string; planData?: QueryPlanData }>,
  planMessageId: string,
  updater: (plan: QueryPlanData) => QueryPlanData
): boolean {
  const idx = messages.findIndex((m) => m.id === planMessageId);
  if (idx < 0 || !messages[idx]?.planData) {
    return false;
  }
  const current = messages[idx].planData!;
  messages[idx] = {
    ...messages[idx],
    planData: updater(current),
  };
  return true;
}
