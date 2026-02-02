'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import MessageList from './MessageList';
import InputArea from './InputArea';
import ToolsPanel from './ToolsPanel';
import { useMcpAdapter } from '@/lib/mcp/hook/useMcpAdapter';
import {
  GPT_MODEL_GENERAL,
  GPT_PROXY_URL,
  TODO_MESSAGE_ID,
} from '@/constants';
import { ChatCompletionCreateParamsBase } from 'openai/resources/chat/completions.js';
import {
  ChatCompletionFunctionTool,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources';
import { GptFunctionName, GptFunctions } from '@/lib/openai/functions';
import { ExecutionStep, Message, Tool } from '@/types';
import { getHoroscope } from '@/lib/openai/actions';
import { useTokenStore } from '@/stores/useTokenStore';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';

const SYSTEM_PROMPT = 
  'You are a helpful AI assistant in the GPT Assistant app with MCP (Model Context Protocol) tools integration. ' +
  'Your role: answer questions clearly, help with tasks, and use available MCP and OpenAI tools when needed. ' +
  'Guidelines: be concise and relevant, explain tool results when useful, and stay helpful and professional. ' +
  `Before executing tools, think step-by-step. If the user's request is complex (requires more than one tool call) you MUST` +
  `1. First call ${GptFunctionName.Planning}, passing it a list of all stages.` +
  '2. Then execute the MCP tools sequentially' +
  '3. Give a general answer at the end.';

export default function GPTAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toolsList, setToolsList] = useState<Tool[]>([
    ...GptFunctions.map((t) => ({
      name: t.function.name,
      description: t.function.description ?? '',
      inputSchema: t.function.parameters ?? {},
    })),
  ]);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mcpTools, setMcpTools] = useState<ChatCompletionTool[]>([]);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedPromptIndex, setSelectedPromptIndex] = useState(0);
  const stepsRef = useRef<ExecutionStep[]>([]);

  const { token } = useTokenStore();

  const {
    tools,
    prompts,
    isConnected,
    callTool,
    getPrompt,
    error: mcpError,
  } = useMcpAdapter();

  const filteredPrompts = useMemo(() => {
    return prompts.filter((p) =>
      p.name.toLowerCase().includes(commandFilter.toLowerCase())
    );
  }, [prompts, commandFilter]);

  useEffect(() => {
    setSelectedPromptIndex(0);
  }, [commandFilter, showCommandMenu]);

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    const toOpenAiTools: ChatCompletionFunctionTool[] = tools.map((t: any) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));

    setMcpTools(toOpenAiTools);
    setToolsList([
      ...GptFunctions.map((t) => ({
        name: t.function.name,
        description: t.function.description ?? '',
        inputSchema: t.function.parameters ?? {},
      })),
      ...toOpenAiTools.map((t) => ({
        name: t.function.name,
        description: t.function.description ?? '',
        inputSchema: t.function.parameters ?? {},
      })),
    ]);
  }, [isConnected, tools]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!mcpError) {
      return;
    }
    setError(mcpError);
  }, [mcpError]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    const lastWord = value.split(/\s/).pop() || '';
    if (lastWord.startsWith('/')) {
      setShowCommandMenu(true);
      setCommandFilter(lastWord.slice(1));
    } else {
      setShowCommandMenu(false);
    }
  };

  function extractPromptText(messages: Array<{ role: string; content?: unknown }>): string {
    if (!Array.isArray(messages)) return '';
    return messages
      .map((m) => {
        const content = m.content;
        if (content && typeof content === 'object' && 'text' in content && typeof (content as { text: string }).text === 'string') {
          return (content as { text: string }).text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }

  async function handleSelectPrompt(prompt: { name: string; description?: string }) {
    try {
      // TODO: Prompt could has required arguments, which we must to send with getPrompt
      const result = await getPrompt(prompt.name);
      const text = extractPromptText(result.messages ?? []);
      setInput((prev) => prev.replace(/\/\S*$/, '').trim() + text);
    } catch {
      setError('Failed to load prompt');
    } finally {
      setShowCommandMenu(false);
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
      setSelectedPromptIndex((i) => Math.min(i + 1, filteredPrompts.length - 1));
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
    case GptFunctionName.Planning: {
      if (!Array.isArray(toolInput.steps)) {
        throw new Error('Invalid steps');        
      }

      const newSteps: ExecutionStep[] = toolInput.steps.map(({ id, label }) => ({
        id,
        label,
        status: 'pending'        
      }));

      stepsRef.current = newSteps;

      return JSON.stringify({ steps: newSteps });
    }
    case GptFunctionName.Horoscope:
      return await getHoroscope({
        name: 'name' in toolInput ? String(toolInput.name) : '',
        sign: 'sign' in toolInput ? String(toolInput.sign) : '',
        sex: 'sex' in toolInput ? String(toolInput.sex) : undefined,
      });
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

      const extractedText = extractMcpText(response);
      if (extractedText) {
        return extractedText;
      }

      return JSON.stringify(response);
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

    try {
      if (!token) {
        throw new Error('OpenAI API key is not configured');
      }

      const conversationMessages: Array<ChatCompletionMessageParam> = [
        { role: 'system', content: SYSTEM_PROMPT },
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

      if (!data.choices?.[0]) {
        throw new Error('Invalid API response: no choices returned');
      }

      while (
        data.choices[0].finish_reason === 'tool_calls' &&
        data.choices[0].message?.tool_calls
      ) {
        const toolCalls = data.choices[0].message.tool_calls;

        conversationMessages.push({
          role: 'assistant',
          content: data.choices[0].message.content || 'Calling tools...',
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

            // TODO вынести в функцию
            setMessages((prev) => {
              const newMessages = [...prev];
              const currentTodoMessageIdx = newMessages.findLastIndex(m => m.id === TODO_MESSAGE_ID);

              if (currentTodoMessageIdx < 0) {
                return prev;
              }
              const steps: ExecutionStep[] = JSON.parse(newMessages[currentTodoMessageIdx].content).steps;
              const stepIdx = stepsRef.current.findIndex(s => s.id === toolCall.function.name);


              if (stepIdx >= 0 ) {
                steps[stepIdx].status = 'running';
                newMessages[currentTodoMessageIdx].content = JSON.stringify({ steps });
              }
              

              return newMessages;
            });
            
            const result = await processTool(
              toolCall.function.name,
              JSON.parse(toolCall.function.arguments)
            );

            const assistantToolMessage: Message = {
              id: `tool-${toolCall.id}`,
              role: 'assistant',
              content: `Using tool: ${toolCall.function.name}`,
              timestamp: new Date(),
              toolName: toolCall.function.name,
              isUiMessage: true,
            };

            // Create TODO list message
            let todoMessage: Message;
            if (toolCall.function.name === GptFunctionName.Planning) {

              // const newSteps = JSON.parse(result).steps;
              // setSteps(newSteps);

              // console.log('stepsRef.current', stepsRef.current);

              todoMessage = {
                id: TODO_MESSAGE_ID,
                role: 'assistant',
                content: result,
                timestamp: new Date(),
                isUiMessage: true,
              };
            }

            setMessages((prev) => [
              ...prev,
              assistantToolMessage,
              ...(todoMessage ? [todoMessage] : []),
            ]);



            // TODO: need check error
            setMessages((prev) => {
              const newMessages = [...prev];
              const currentTodoMessageIdx = newMessages.findLastIndex(m => m.id === TODO_MESSAGE_ID);

              if (currentTodoMessageIdx < 0) {
                return prev;
              }
              const steps: ExecutionStep[] = JSON.parse(newMessages[currentTodoMessageIdx].content).steps;
              const stepIdx = stepsRef.current.findIndex(s => s.id === toolCall.function.name);

              if (stepIdx >= 0 ) {
                steps[stepIdx].status = 'completed';
                newMessages[currentTodoMessageIdx].content = JSON.stringify({ steps });
              }

              return newMessages;
            });

            conversationMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: result,
            });
          } catch (err: any) {
            conversationMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                error:
                  'Tool execution failed: ' +
                  `${err.message || 'Unknown error'}`,
              }),
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
        if (!data?.choices?.[0]?.message) {
          throw new Error(
            'Invalid API response structure: missing choices or message'
          );
        }
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.choices[0].message.content || 'No response',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      const errorAssistantMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${errorMessage}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorAssistantMessage]);
    } finally {
      setLoading(false);
    }
  }

  function handleClearMessage() {
    setInput('');
  }

  return (
    <div className="flex h-full w-full">
      <ToolsPanel tools={toolsList} />

      <div className="flex flex-col flex-1 h-full">
        <header className="bg-gray-900 border-b border-t border-gray-800 px-6 py-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">GPT Assistant</h1>
              <p className="text-sm text-gray-400">
                Powered by OpenAI with MCP Tools Integration
              </p>
            </div>
          </div>
          {error && (
            <div className="mt-3 p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
              {error}
            </div>
          )}

          {!token && (
            <div className="bg-blue-900/30 border border-blue-500/50 mt-3 p-4 rounded-lg">
              <p className="flex items-center gap-1 text-sm text-blue-200">
                <TriangleAlert className="text-yellow-500 h-4 w-4" />
                To use the chat, you need to set <b>your personal access token</b>.
              </p>
              <p className="text-sm text-blue-200">
                Go to the <Link href="/about" className="font-bold underline">About Us</Link>, 
                where you will find the input field in the 'OpenAI Configuration' area."
              </p>
            </div>
          )}          
        </header>

        <div className="flex-1 overflow-y-auto">
          <MessageList
            messages={messages}
            loading={loading}
          />
        </div>

        <div className="relative">
          {showCommandMenu && filteredPrompts.length > 0 && (
            <div
              aria-label="command-menu"
              className="absolute bottom-full left-0 right-0 mb-2 mx-6 max-h-64 overflow-auto rounded-lg border border-gray-700 bg-gray-800 shadow-xl z-50 py-1"
            >
              {filteredPrompts.map((prompt, index) => (
                <button
                  key={prompt.name}
                  type="button"
                  className={`w-full text-left px-4 py-2.5 flex flex-col gap-0.5 transition-colors ${
                    index === selectedPromptIndex
                      ? 'bg-gray-700 text-white'
                      : 'hover:bg-gray-700/80'
                  }`}
                  onClick={() => handleSelectPrompt(prompt)}
                >
                  <span className="font-medium text-white text-sm">{prompt.name}</span>
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
