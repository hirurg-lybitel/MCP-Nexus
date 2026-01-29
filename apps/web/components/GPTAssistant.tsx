"use client";

import { useState, useRef, useEffect } from "react";
import { Zap } from "lucide-react";
import MessageList from "./MessageList";
import InputArea from "./InputArea";
import ToolsPanel from "./ToolsPanel";
import { useMcpAdapter } from "@/lib/mcp/hook/useMcpAdapter";
import { GPT_MODEL_GENERAL, GPT_PROXY_URL, OPENAI_SECURITY_KEY } from "@/constants";
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.js";
import { ChatCompletionFunctionTool, ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources";
import { GptFunctionName, GptFunctions } from "@/lib/openai/functions";
import { Message, Tool } from "@/types";
import { getHoroscope } from "@/lib/openai/actions";

export default function GPTAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolsList, setToolsList] = useState<Tool[]>([
    ...GptFunctions.map(t => ({ name: t.function.name, description: t.function.description ?? '', inputSchema: t.function.parameters ?? {} }))
  ]);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mcpTools, setMcpTools] = useState<ChatCompletionTool[]>([]);


  const { tools, isConnected, callTool, error: mcpError } = useMcpAdapter();

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
      ...GptFunctions.map(t => ({ name: t.function.name, description: t.function.description ?? '', inputSchema: t.function.parameters ?? {} })), 
      ...toOpenAiTools.map(t => ({ name: t.function.name, description: t.function.description ?? '', inputSchema: t.function.parameters ?? {} }))
    ]);
  }, [isConnected, tools]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!mcpError) { 
      return;
    }
    setError(mcpError);
  }, [mcpError]);

  function extractMcpText(response: unknown): string | null {
    if (!response || typeof response !== "object") {
      return null;
    }

    const record = response as Record<string, unknown>;
    const content = record.content;
    if (!Array.isArray(content)) {
      return null;
    }

    const parts = content
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const itemRecord = item as Record<string, unknown>;
        if (itemRecord.type === "text") {
          return typeof itemRecord.text === "string" ? itemRecord.text : null;
        }
        if (itemRecord.type === "resource") {
          const resource = itemRecord.resource as Record<string, unknown> | undefined;
          if (resource && typeof resource.text === "string") {
            return resource.text;
          }
        }
        return null;
      })
      .filter((part): part is string => typeof part === "string" && part.length > 0);

    return parts.length > 0 ? parts.join("\n") : null;
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
        sex: 'sex' in toolInput ? String(toolInput.sex) : undefined 
      });
    } 

    try {
      const response = await callTool(toolName, toolInput);
      if (!response) {
        throw new Error("Empty response");
      }

      console.log('processTool response', response);

      if (typeof response === "string") {
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
    }
    catch (err: any) {
      return JSON.stringify({ error: `Tool execution failed. ${err.message ?? 'unknown'}` });
    }
  }

  async function handleSendMessage() {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      if (!OPENAI_SECURITY_KEY) {
        throw new Error("OpenAI API key is not configured");
      }

      const conversationMessages: Array<ChatCompletionMessageParam> = messages
        .filter((msg) => !msg.isUiMessage)
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      conversationMessages.push({
        role: "user",
        content: input,
      });

      
      const openaiTools = [
        ...GptFunctions
      ];

      const abortController = new AbortController();

      const chatGPTRequest: ChatCompletionCreateParamsBase = {
        ...GPT_MODEL_GENERAL,
        tools: [...openaiTools, ...mcpTools],
        messages: conversationMessages
      };

      let response = await fetch(GPT_PROXY_URL, {
        method: "POST",
        body: JSON.stringify({
          ...chatGPTRequest,
          security_key: OPENAI_SECURITY_KEY,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || "OpenAI API error"
        );
      }

      let data = await response.json();

      if (!data.choices?.[0]) {
        throw new Error("Invalid API response: no choices returned");
      }


      while (
        data.choices[0].finish_reason === "tool_calls" &&
        data.choices[0].message?.tool_calls
      ) {
        const toolCalls = data.choices[0].message.tool_calls;

        conversationMessages.push({
          role: "assistant",
          content: data.choices[0].message.content || "Calling tools...",
          tool_calls: toolCalls.map((toolCall) => ({
            type: "function",
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

            const result = await processTool(
              toolCall.function.name,
              JSON.parse(toolCall.function.arguments)
            );

            const assistantToolMessage: Message = {
              id: `tool-${toolCall.id}`,
              role: "assistant",
              content: `Using tool: ${toolCall.function.name}`,
              timestamp: new Date(),
              toolName: toolCall.function.name,
              isUiMessage: true,
            };
            setMessages((prev) => [...prev, assistantToolMessage]);

            conversationMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: result,
            });
          } catch (err: any) {
            conversationMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: "Tool execution failed: " + `${err.message || 'Unknown error'}` }),
            });
          }
        }

        const chatGPTRequest: ChatCompletionCreateParamsBase = {
          ...GPT_MODEL_GENERAL,
          tools: [...openaiTools, ...mcpTools],
          messages: conversationMessages
        };

        response = await fetch(GPT_PROXY_URL, {
          method: "POST",
          body: JSON.stringify({
            ...chatGPTRequest,
            security_key: OPENAI_SECURITY_KEY,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error?.message || "OpenAI API error"
          );
        }

        data = await response.json();
        if (!data?.choices?.[0]?.message) {
          throw new Error("Invalid API response structure: missing choices or message");
        }
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.choices[0].message.content || "No response",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);

      const errorAssistantMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
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
    <div className="flex h-screen bg-linear-to-br from-gray-950 via-gray-900 to-gray-950">
      <ToolsPanel tools={toolsList} />

      <div className="flex flex-col flex-1 ">
        <header className="bg-gray-900 border-b border-t border-gray-800 px-6 py-4 shadow-lg">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold text-white">
                GPT Assistant
              </h1>
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
        </header>

        <MessageList messages={messages} loading={loading} />

        <InputArea
          input={input}
          setInput={setInput}
          loading={loading}
          onSendMessage={handleSendMessage}
          onClearMessage={handleClearMessage}
        />
      </div>
    </div>
  );
}
