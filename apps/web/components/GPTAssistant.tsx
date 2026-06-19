'use client';

import { useState, useRef, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { flushSync } from 'react-dom';
import MessageList from './MessageList';
import InputArea from './InputArea';
import ToolsPanel from './ToolsPanel';
import { useMcpAdapter } from '@/lib/mcp/hook/useMcpAdapter';
import {
  CHAT_CONTENT_MAX_WIDTH,
  GPT_MODEL_GENERAL,
  GPT_PROXY_URL,
  QUERY_PLAN_MESSAGE_ID,
} from '@/constants';
import {
  markAllPlanStepsCompleted,
  markPlanStepCompleted,
  markPlanStepRunning,
} from '@/lib/chat/plan-progress';
import { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions.js';
import {
  ChatCompletionFunctionTool,
  ChatCompletionMessageParam,
} from 'openai/resources';
import { executeAgentTool } from '@/lib/agent/execute-agent-tool';
import { AgentToolName, isAgentTool } from '@/lib/agent/tool-names';
import { shouldShowToolCallPanel } from '@/lib/chat/tool-ui';
import { GptFunctionName, GptFunctions } from '@/lib/openai/functions';
import { Message, QueryPlanData, Tool } from '@/types';
import { getHoroscope } from '@/lib/openai/actions';
import { useTokenStore } from '@/stores/useTokenStore';
import { useMcpKeyStore } from '@/stores/useMcpKeyStore';
import Link from 'next/link';
import { Trash, TriangleAlert } from 'lucide-react';
import PromptArgsModal from './PromptArgsModal';
import ConfirmDialog from './ConfirmDialog';
import { McpPrompt } from '@/lib/mcp/client';
import Button from './basic/Button';
import { parseQueryPlanFromToolResult } from '@/lib/chat/parse-query-plan';
import { parseTableFromToolResult } from '@/lib/chat/parse-tool-table';
import { stripMarkdownTables } from '@/lib/chat/strip-markdown-tables';
import { buildSystemPrompt } from '@/lib/chat/system-prompt';
import { TurnUsageAccumulator } from '@/lib/chat/turn-usage';
import { projectToolResultForModel } from '@/lib/agent/agent-tool-projector';
import { toolResultPayload } from '@/lib/chat/tool-result-payload';
import { sanitizeToolResultForUi } from '@/lib/chat/tool-result-ui-sanitize';
import { useDomainContextStore } from '@/stores/useDomainContextStore';
import { useLocaleStore } from '@/stores/useLocaleStore';
import { useTranslations } from '@/lib/i18n/use-translations';

const LOCALE_PROMPT_ARG = 'locale';

function getUserPromptArguments(
  prompt: McpPrompt
): NonNullable<McpPrompt['arguments']> {
  return (
    prompt.arguments?.filter((arg) => arg.name !== LOCALE_PROMPT_ARG) ?? []
  );
}

function promptNeedsArgsModal(prompt: McpPrompt): boolean {
  return getUserPromptArguments(prompt).length > 0;
}

function patchActivePlanMessage(
  messages: Message[],
  updater: (plan: QueryPlanData) => QueryPlanData
): Message[] {
  const idx = messages.findIndex(
    (m) => m.id === QUERY_PLAN_MESSAGE_ID && m.planData
  );
  if (idx < 0) {
    return messages;
  }
  return messages.map((m, i) =>
    i === idx ? { ...m, planData: updater(m.planData!) } : m
  );
}

/** Force plan To-do UI to paint before long await processTool / fetch. */
function flushPlanProgress(
  setMessages: Dispatch<SetStateAction<Message[]>>,
  updater: (plan: QueryPlanData) => QueryPlanData
): void {
  flushSync(() => {
    setMessages((prev) => patchActivePlanMessage(prev, updater));
  });
}

export default function GPTAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedPromptIndex, setSelectedPromptIndex] = useState(0);
  const [showArgsModal, setShowArgsModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<McpPrompt | null>(null);

  const { token } = useTokenStore();
  const { mcpKey, isValidated } = useMcpKeyStore();
  const { domainContext } = useDomainContextStore();
  const locale = useLocaleStore((s) => s.locale);
  const { t } = useTranslations();

  const {
    tools,
    prompts,
    isConnected,
    authRequired: mcpAuthRequired,
    mcpKeyVerified,
    callTool,
    getPrompt,
    error: mcpError,
  } = useMcpAdapter();

  const filteredPrompts = useMemo(() => {
    return prompts.filter((p) =>
      p.name.toLowerCase().includes(commandFilter.toLowerCase())
    );
  }, [prompts, commandFilter]);

  const hostTools = useMemo<Tool[]>(
    () =>
      GptFunctions.map((t) => ({
        name: t.function.name,
        description: t.function.description ?? '',
        inputSchema: t.function.parameters ?? {},
      })),
    []
  );

  const mcpTools = useMemo<ChatCompletionFunctionTool[]>(() => {
    if (!isConnected) {
      return [];
    }
    return tools.map((t: any) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
  }, [isConnected, tools]);

  const toolsList = useMemo<Tool[]>(
    () => [
      ...hostTools,
      ...mcpTools.map((t) => ({
        name: t.function.name,
        description: t.function.description ?? '',
        inputSchema: t.function.parameters ?? {},
      })),
    ],
    [hostTools, mcpTools]
  );

  const displayError = error ?? mcpError ?? null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    const lastWord = value.split(/\s/).pop() || '';
    if (lastWord.startsWith('/')) {
      const newFilter = lastWord.slice(1);
      setShowCommandMenu(true);
      if (!showCommandMenu || newFilter !== commandFilter) {
        setSelectedPromptIndex(0);
      }
      setCommandFilter(newFilter);
    } else {
      setShowCommandMenu(false);
    }
  };

  function extractPromptText(
    messages: Array<{ role: string; content?: unknown }>
  ): string {
    if (!Array.isArray(messages)) return '';
    return messages
      .map((m) => {
        const content = m.content;
        if (
          content &&
          typeof content === 'object' &&
          'text' in content &&
          typeof (content as { text: string }).text === 'string'
        ) {
          return (content as { text: string }).text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }

  async function handleSelectPrompt(prompt: McpPrompt) {
    if (promptNeedsArgsModal(prompt)) {
      setSelectedPrompt(prompt);
      setShowArgsModal(true);
      setShowCommandMenu(false);
      return;
    }

    try {
      const result = await getPrompt(prompt.name, { locale });
      const text = extractPromptText(result.messages ?? []);
      setInput((prev) => prev.replace(/\/\S*$/, '').trim() + text);
    } catch {
      setError(t('chat.failedLoadPrompt'));
    } finally {
      setShowCommandMenu(false);
    }
  }

  async function handleArgsSubmit(args: Record<string, unknown>) {
    if (!selectedPrompt) return;

    try {
      const result = await getPrompt(selectedPrompt.name, { ...args, locale });
      const text = extractPromptText(result.messages ?? []);
      setInput((prev) => prev.replace(/\/\S*$/, '').trim() + text);
    } catch {
      setError(t('chat.failedLoadParameterizedPrompt'));
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!showCommandMenu || filteredPrompts.length === 0) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setShowCommandMenu(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedPromptIndex((i) =>
        Math.min(i + 1, filteredPrompts.length - 1)
      );
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedPromptIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter' && filteredPrompts[selectedPromptIndex]) {
      e.preventDefault();
      handleSelectPrompt(filteredPrompts[selectedPromptIndex]);
    }
  }

  function extractMcpText(response: unknown): string | null {
    if (!response || typeof response !== 'object') {
      return null;
    }

    const record = response as Record<string, unknown>;
    const content = record.content;
    if (!Array.isArray(content)) {
      return null;
    }

    const parts = content
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const itemRecord = item as Record<string, unknown>;
        if (itemRecord.type === 'text') {
          return typeof itemRecord.text === 'string' ? itemRecord.text : null;
        }
        if (itemRecord.type === 'resource') {
          const resource = itemRecord.resource as
            | Record<string, unknown>
            | undefined;
          if (resource && typeof resource.text === 'string') {
            return resource.text;
          }
        }
        return null;
      })
      .filter(
        (part): part is string => typeof part === 'string' && part.length > 0
      );

    return parts.length > 0 ? parts.join('\n') : null;
  }

  async function processTool(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<string> {
    console.log('processTool', { toolName, toolInput });

    switch (toolName) {
    case GptFunctionName.Horoscope:
      return await getHoroscope({
        name: 'name' in toolInput ? String(toolInput.name) : '',
        sign: 'sign' in toolInput ? String(toolInput.sign) : '',
        sex: 'sex' in toolInput ? String(toolInput.sex) : undefined,
      });
    default:
      break;
    }

    if (isAgentTool(toolName)) {
      try {
        return await executeAgentTool(toolName, toolInput, {
          mcpAuthToken:
            isValidated && mcpKey ? mcpKey : undefined,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'unknown';
        return JSON.stringify({
          error: `Agent tool failed. ${message}`,
        });
      }
    }

    try {
      const response = await callTool(toolName, toolInput);
      if (!response) {
        throw new Error('Empty response');
      }

      console.log('processTool response', response);

      if (typeof response === 'string') {
        return response;
      }

      const resRecord = response as Record<string, unknown>;
      if (resRecord.isError) {
        const errorText = extractMcpText(response);
        throw new Error(errorText ?? 'unknown');
      }

      return toolResultPayload(response);
    } catch (err: any) {
      return JSON.stringify({
        error: `Tool execution failed. ${err.message ?? 'unknown'}`,
      });
    }
  }

  async function handleSendMessage() {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    const turnUsage = new TurnUsageAccumulator();

    try {
      if (!token) {
        throw new Error('OpenAI API key is not configured');
      }

      const conversationMessages: Array<ChatCompletionMessageParam> = [
        { role: 'system', content: buildSystemPrompt(domainContext, locale) },
        ...messages
          .filter((msg) => !msg.isUiMessage)
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        { role: 'user', content: input },
      ];

      const openaiTools = [...GptFunctions];

      const abortController = new AbortController();

      const chatGPTRequest: ChatCompletionCreateParamsBase = {
        ...GPT_MODEL_GENERAL,
        tools: [...openaiTools, ...mcpTools],
        messages: conversationMessages,
      };

      let response = await fetch(GPT_PROXY_URL, {
        method: 'POST',
        body: JSON.stringify({
          ...chatGPTRequest,
          security_key: token,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        let errorMessage = 'OpenAI proxy error';

        if (response.status === 403) {
          errorMessage = 'Authentication failed – please verify your OpenAI token.';
          throw new Error(errorMessage);
        }

        try {
          const errorBody = await response.text();
          errorMessage = errorBody.trim() || `HTTP ${response.status}`;

          // try to parse JSON error if proxy sometimes returns JSON
          try {
            const jsonError = JSON.parse(errorBody);
            errorMessage = jsonError.error?.message || jsonError.message || errorBody;
          } catch {
            // it's plain text → keep it as is
          }
        } catch {
          // can't even read body
        }
        throw new Error(errorMessage);
      }

      let data = await response.json();
      turnUsage.recordApiUsage(data.usage, GPT_MODEL_GENERAL.model);

      if (!data.choices?.[0]) {
        throw new Error('Invalid API response: no choices returned');
      }

      let dataTablePresentedThisTurn = false;

      while (
        data.choices[0].finish_reason === 'tool_calls' &&
        data.choices[0].message?.tool_calls
      ) {
        const toolCalls = data.choices[0].message.tool_calls;

        conversationMessages.push({
          role: 'assistant',
          content: data.choices[0].message.content || t('chat.callingTools'),
          tool_calls: toolCalls.map((toolCall: any) => ({
            type: 'function',
            id: toolCall.id,
            function: {
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
            },
          })),
        });

        for (const toolCall of toolCalls) {
          try {
            console.log('toolCall', toolCall);

            const toolName = toolCall.function.name;

            flushPlanProgress(setMessages, (plan) =>
              markPlanStepRunning(plan, toolName)
            );

            const result = await processTool(
              toolName,
              JSON.parse(toolCall.function.arguments)
            );

            turnUsage.recordToolCall(toolName);

            const planData = parseQueryPlanFromToolResult(
              toolCall.function.name,
              result
            );
            const tableData = parseTableFromToolResult(
              toolCall.function.name,
              result
            );

            let toolInput: Record<string, unknown> = {};
            try {
              toolInput = JSON.parse(toolCall.function.arguments) as Record<
                string,
                unknown
              >;
            } catch {
              toolInput = { _raw: toolCall.function.arguments };
            }

            const assistantToolMessage: Message = {
              id: `tool-${toolCall.id}`,
              role: 'assistant',
              content: '',
              timestamp: new Date(),
              toolName: toolCall.function.name,
              toolInput,
              toolResult: sanitizeToolResultForUi(toolName, result),
              isUiMessage: true,
            };

            const planMessage: Message | undefined = planData
              ? {
                id: QUERY_PLAN_MESSAGE_ID,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
                planData,
                isUiMessage: true,
              }
              : undefined;

            const tableMessage: Message | undefined = tableData
              ? (() => {
                dataTablePresentedThisTurn = true;
                return {
                  id: `table-${toolCall.id}`,
                  role: 'assistant' as const,
                  content: '',
                  timestamp: new Date(),
                  tableData,
                  isUiMessage: true,
                };
              })()
              : undefined;

            setMessages((prev) => {
              const withoutActivePlan = planMessage
                ? prev.filter((m) => m.id !== QUERY_PLAN_MESSAGE_ID)
                : prev;
              return [
                ...withoutActivePlan,
                ...(shouldShowToolCallPanel(toolName)
                  ? [assistantToolMessage]
                  : []),
                ...(planMessage ? [planMessage] : []),
                ...(tableMessage ? [tableMessage] : []),
              ];
            });

            if (!planMessage) {
              const stepSucceeded =
                toolName !== AgentToolName.PresentQueryResult ||
                Boolean(tableData);
              if (stepSucceeded) {
                flushPlanProgress(setMessages, (plan) =>
                  markPlanStepCompleted(plan, toolName)
                );
              }
            }

            conversationMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: projectToolResultForModel(toolName, result),
            });
          } catch (err: any) {
            const errorResult = JSON.stringify({
              error:
                'Tool execution failed: ' +
                `${err.message || 'Unknown error'}`,
            });

            let failedInput: Record<string, unknown> = {};
            try {
              failedInput = JSON.parse(toolCall.function.arguments) as Record<
                string,
                unknown
              >;
            } catch {
              failedInput = { _raw: toolCall.function.arguments };
            }

            if (shouldShowToolCallPanel(toolCall.function.name)) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `tool-${toolCall.id}`,
                  role: 'assistant',
                  content: '',
                  timestamp: new Date(),
                  toolName: toolCall.function.name,
                  toolInput: failedInput,
                  toolResult: errorResult,
                  isUiMessage: true,
                },
              ]);
            }

            conversationMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: errorResult,
            });
          }
        }

        const chatGPTRequest: ChatCompletionCreateParamsBase = {
          ...GPT_MODEL_GENERAL,
          tools: [...openaiTools, ...mcpTools],
          messages: conversationMessages,
        };

        response = await fetch(GPT_PROXY_URL, {
          method: 'POST',
          body: JSON.stringify({
            ...chatGPTRequest,
            security_key: token,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'OpenAI API error');
        }

        data = await response.json();
        turnUsage.recordApiUsage(data.usage, GPT_MODEL_GENERAL.model);
        if (!data?.choices?.[0]?.message) {
          throw new Error(
            'Invalid API response structure: missing choices or message'
          );
        }
      }

      flushPlanProgress(setMessages, markAllPlanStepsCompleted);

      let finalContent = data.choices[0].message.content || t('chat.noResponse');
      if (dataTablePresentedThisTurn && finalContent.trim()) {
        finalContent = stripMarkdownTables(finalContent, locale);
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: finalContent,
        timestamp: new Date(),
        usageMeta: turnUsage.build(GPT_MODEL_GENERAL.model),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      const errorAssistantMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: t('chat.errorPrefix', { message: errorMessage }),
        timestamp: new Date(),
        usageMeta: turnUsage.build(GPT_MODEL_GENERAL.model),
      };
      setMessages((prev) => [...prev, errorAssistantMessage]);
    } finally {
      setLoading(false);
    }
  }

  function handleClearMessage() {
    setInput('');
  }

  function handleConfirmClearHistory() {
    setMessages([]);
  }

  return (
    <div className="flex h-full w-full min-w-0 overflow-hidden">
      <PromptArgsModal
        isOpen={showArgsModal}
        onClose={() => setShowArgsModal(false)}
        onSubmit={handleArgsSubmit}
        arguments={
          selectedPrompt ? getUserPromptArguments(selectedPrompt) : []
        }
        promptName={selectedPrompt?.name || ''}
      />

      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleConfirmClearHistory}
        title={t('chat.clearHistoryConfirmTitle')}
        message={t('chat.clearHistoryConfirmMessage')}
        confirmLabel={t('chat.clearHistoryConfirm')}
        cancelLabel={t('promptModal.cancel')}
        confirmDisabled={loading}
      />

      <ToolsPanel tools={toolsList} />

      <div className="relative flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <header className="absolute w-full p-2 bg-transparent border-t border-gray-800">
          <div className={`mx-auto w-full max-w-5xl min-w-0 px-2`}>

            <div className="flex items-center gap-3 justify-between">
              {domainContext.trim() ? (
                <p className="text-xs text-gray-500 shrink-0">
                  {t('chat.userContextActive')}
                </p>
              ) : (
                <div className="flex-1" />
              )}
              {messages.length > 0 && (
                <Button
                  variant="danger"
                  size="xs"
                  onClick={() => setShowClearConfirm(true)}
                  disabled={loading}
                  title={t('chat.clearHistory')}
                >
                  <Trash className="h-5 w-5 " />
                </Button>
              )}
            </div>

            {displayError && (
              <div className="max-w-2xl mx-auto bg-gray-900">
                <div className="mt-3 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
                  {displayError}
                </div>
              </div> 
            )}

            {!token && (
              <div className="bg-gray-900 rounded-lg max-w-2xl mt-3 mx-auto">
                <div className={`bg-blue-900/30 border border-blue-500/50 p-4 rounded-lg`}>
                  <p className="flex items-center gap-1 text-sm text-blue-200">
                    <TriangleAlert className="text-yellow-500 h-4 w-4" />
                    {t('chat.tokenBannerLead')}{' '}
                    <b>{t('chat.tokenBannerBold')}</b>.
                  </p>
                  <p className="text-sm text-blue-200">
                    {t('chat.tokenBannerTail')}{' '}
                    <Link
                      href="/settings"
                      className="font-bold underline"
                    >
                      {t('chat.tokenBannerSettings')}
                    </Link>{' '}
                    {t('chat.tokenBannerEnd')}
                  </p>
                </div>
              </div>
            )}

            {token && mcpAuthRequired && !mcpKeyVerified && (
              <div className="bg-gray-900 rounded-lg max-w-2xl mt-3 mx-auto">
                <div className="bg-amber-900/30 border border-amber-500/50 p-4 rounded-lg">
                  <p className="flex items-center gap-1 text-sm text-amber-200">
                    <TriangleAlert className="text-yellow-500 h-4 w-4" />
                    {t('chat.mcpBannerLead')}{' '}
                    <b>{t('chat.mcpBannerBold')}</b>.
                  </p>
                  <p className="text-sm text-amber-200">
                    {t('chat.mcpBannerTail')}{' '}
                    <Link href="/settings" className="font-bold underline">
                      {t('chat.mcpBannerSettings')}
                    </Link>
                    {t('chat.mcpBannerEnd')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          <MessageList
            messages={messages}
            loading={loading}
          />
        </div>

        <div
          className={`relative mx-auto w-full ${CHAT_CONTENT_MAX_WIDTH} min-w-0 px-6`}
        >
          {showCommandMenu && filteredPrompts.length > 0 && (
            <div
              aria-label="command-menu"
              className="absolute bottom-full left-0 right-0 mb-2 max-h-96 overflow-auto rounded-lg border border-gray-700 bg-gray-800 shadow-xl z-50 p-1"
            >
              {filteredPrompts.map((prompt, index) => (
                <button
                  key={prompt.name}
                  type="button"
                  className={`w-full text-left rounded-md px-4 py-2.5 flex flex-col gap-0.5 transition-colors ${
                    index === selectedPromptIndex
                      ? 'bg-gray-700 text-white'
                      : 'hover:bg-gray-700/80'
                  }`}
                  onClick={() => handleSelectPrompt(prompt)}
                >
                  <span className="font-medium text-white text-sm">
                    {prompt.name}
                  </span>
                  {prompt.description && (
                    <span className="text-xs text-gray-400">
                      {prompt.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          <InputArea
            input={input}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            loading={loading}
            disabled={!token}
            onSendMessage={handleSendMessage}
            onClearMessage={handleClearMessage}
          />
        </div>
      </div>
    </div>
  );
}
