import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions";

export const HOST = process.env.HOST ?? process.env.HOSTNAME ?? 'localhost';
export const PORT = process.env.PORT ?? '4004';
export const MCP_PORT = process.env.NEXT_PUBLIC_MCP_PORT ?? '4005';
// export const MCP_URL = `http://localhost:${MCP_PORT}/mcp`;
// export const MCP_URL = `api/mcp`;
export const OPENAI_SECURITY_KEY = process.env.NEXT_PUBLIC_OPENAI_SECURITY_KEY;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const OPENAI_PROJECT_KEY = process.env.OPENAI_PROJECT_KEY;
export const GPT_PROXY_URL = 'https://chatgpt-proxy.gdmn.app/openai';

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
  model: 'gpt-5.4-mini',
  max_completion_tokens: MAX_TOKENS,
};

export const TODO_MESSAGE_ID = 'todo_message';

/** Active query plan card for the current assistant turn (step progress). */
export const QUERY_PLAN_MESSAGE_ID = 'query_plan_active';

/** Max width of chat messages and input on wide screens (Tailwind class). */
export const CHAT_CONTENT_MAX_WIDTH = 'max-w-4xl';

/** Max characters for user-provided domain context appended to the chat system prompt. */
export const MAX_DOMAIN_CONTEXT_CHARS = 8000;