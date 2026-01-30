import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions";

export const PORT = process.env.PORT ?? '4004';
export const MCP_PORT = process.env.NEXT_PUBLIC_MCP_PORT ?? '4005';
export const MCP_URL = `http://localhost:${MCP_PORT}/mcp`;
export const OPENAI_SECURITY_KEY = process.env.NEXT_PUBLIC_OPENAI_SECURITY_KEY;
export const GPT_PROXY_URL = "https://chatgpt-proxy.gdmn.app/openai";

export type GPT_MODEL = {
  model: string;
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  reasoning_effort?: ChatCompletionCreateParamsBase['reasoning_effort'];
  web_search_options?: object;
};

export const MAX_TOKENS = 16384;

export const GPT_MODEL_GENERAL: GPT_MODEL = {
  model: "gpt-4.1-mini",
  temperature: 0.1,
  max_tokens: MAX_TOKENS,
};

export const TODO_MESSAGE_ID = 'todo_message';