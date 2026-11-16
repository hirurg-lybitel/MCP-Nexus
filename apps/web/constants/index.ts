import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions";

export const HOST = process.env.HOST ?? process.env.HOSTNAME ?? 'localhost';
export const PORT = process.env.PORT ?? '4004';
/** Upstream MCP v2 HTTP port (apps/mcp-server). BFF proxies here. */
export const MCP_PORT = process.env.MCP_PORT ?? process.env.NEXT_PUBLIC_MCP_PORT ?? '4005';
/** Full upstream MCP URL for the web BFF (2.10 pure client). */
export const MCP_UPSTREAM_URL =
  process.env.MCP_UPSTREAM_URL?.trim() ||
  `http://127.0.0.1:${MCP_PORT}/mcp`;
/**
 * Legacy: start the in-process Firebird MCP inside apps/web.
 * Default off — chat uses apps/mcp-server only (D5 / 2.10).
 */
export const WEB_EMBEDDED_MCP =
  process.env.WEB_EMBEDDED_MCP === '1' ||
  process.env.WEB_EMBEDDED_MCP === 'true';
export const OPENAI_SECURITY_KEY = process.env.NEXT_PUBLIC_OPENAI_SECURITY_KEY;
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

/**
 * Per-tool MCP call timeout (ms). SDK default is 60s; Gedemin worker reports
 * often need 120–180s (BUG-05). Override with MCP_TOOL_CALL_TIMEOUT_MS.
 */
export const MCP_TOOL_CALL_TIMEOUT_MS = (() => {
  const raw = Number.parseInt(
    process.env.MCP_TOOL_CALL_TIMEOUT_MS ?? '180000',
    10
  );
  return Number.isFinite(raw) && raw > 0 ? raw : 180_000;
})();
