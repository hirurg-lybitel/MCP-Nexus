export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolName?: string;
  isUiMessage?: boolean;
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