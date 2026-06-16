import type { TurnUsageMeta } from '@/lib/chat/turn-usage';

export interface TableColumn {
  key: string;
  label: string;
}

export type QueryPlanStepStatus = 'pending' | 'running' | 'completed';

export interface QueryPlanStep {
  phase: 'discovery' | 'query' | 'present';
  tool?: string;
  description: string;
  /** Filled by UI as tools run (not from MCP). */
  status?: QueryPlanStepStatus;
}

export interface QueryPlanTable {
  tableName: string;
  displayName?: string;
  role: string;
}

export interface QueryPlanData {
  userIntent: string;
  summary: string;
  discoverySteps: QueryPlanStep[];
  tables: QueryPlanTable[];
  sqlStrategy: string;
  notes?: string;
}

export interface TableDisplayData {
  title?: string;
  columns: TableColumn[];
  rows: Record<string, unknown>[];
  meta?: {
    rowCount?: number;
    truncated?: boolean;
    /** Columns hidden in UI (still in tool JSON for the model). */
    hiddenColumnCount?: number;
    allColumnCount?: number;
  };
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  isUiMessage?: boolean;
  /** Structured table rendered as a dedicated UI block (Firebird / SQL tools). */
  tableData?: TableDisplayData;
  /** Query plan from host agent tool create_query_plan. */
  planData?: QueryPlanData;
  /** LLM cost and resource metrics for this assistant turn. */
  usageMeta?: TurnUsageMeta;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type ExecutionStep = {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error';
};