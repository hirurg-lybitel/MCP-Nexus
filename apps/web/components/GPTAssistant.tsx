"use client";

import { useState, useRef, useEffect } from "react";
import { Zap } from "lucide-react";
import MessageList from "./MessageList";
import InputArea from "./InputArea";
import ToolsPanel from "./ToolsPanel";
import { useMcpAdapter } from "@/lib/mcp/hook/useMcpAdapter";
import { GPT_MODEL_GENERAL, GPT_PROXY_URL, OPENAI_SECURITY_KEY } from "@/constants";
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.js";
import { ChatCompletionFunctionTool, ChatCompletionTool } from "openai/resources";
import { GptFunctionName, GptFunctions } from "@/lib/openai/functions";
import { Message, Tool } from "@/types";
import { getHoroscope } from "@/lib/openai/actions";

export default function GPTAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolsList, setToolsList] = useState<Tool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [mcpTools, setMcpTools] = useState<ChatCompletionTool[]>([]);
  const mcpToolNamesRef = useRef<Set<string>>(new Set());

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
    mcpToolNamesRef.current = new Set(toOpenAiTools.map(t => t.function.name));
  }, [isConnected, tools]);

  //   useEffect(() => {
  //     const loadTools = async () => {
  //       try {
  //         const response = await fetch("/api/mcp", {
  //           method: "POST",
  //           headers: { "Content-Type": "application/json" },
  //           body: JSON.stringify({ action: "list_tools" }),
  //         });
  //         const data = await response.json();
  //         setTools(data.tools || []);
  //       } catch (err) {
  //         console.error("Error loading tools:", err);
  //         setError("Failed to load tools");
  //       }
  //     };

  //     loadTools();
  //   }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function processTool(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<string> {
    // try {
    //   const response = await fetch("/api/mcp", {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({
    //       action: "call_tool",
    //       toolName,
    //       toolInput,
    //     }),
    //   });
    //   const data = await response.json();
    //   return data.result || JSON.stringify(data);
    // } catch (err) {
    //   return JSON.stringify({ error: "Tool execution failed" });
    // }
    console.log('processTool', { toolName, toolInput });
    switch (toolName) {
    case GptFunctionName.Horoscope:
      return await getHoroscope({ 
        name: 'name' in toolInput ? String(toolInput.name) : '', 
        sign: 'sign' in toolInput ? String(toolInput.sign) : '', 
        sex: 'sex' in toolInput ? String(toolInput.sex) : undefined 
      });
    } 

    console.log('processTool 2');
    
    try {
      const response: any = await callTool(toolName, toolInput);
      console.log('processTool response', response);
      return response || JSON.stringify({ error: "Tool execution failed" });  
    }
    catch (err) {
      return JSON.stringify({ error: "Tool execution failed" });
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

      const conversationMessages: Array<{
        role: "user" | "assistant";
        content: string;
      }> = messages.map((msg) => ({
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

      while (
        data.choices[0].finish_reason === "tool_calls" &&
        data.choices[0].message.tool_calls
      ) {
        const toolCalls = data.choices[0].message.tool_calls;

        conversationMessages.push({
          role: "assistant",
          content:
            data.choices[0].message.content || "Calling tools...",
        });

        const toolResults = [];
        for (const toolCall of toolCalls) {
          try {
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
            };
            setMessages((prev) => [...prev, assistantToolMessage]);

            toolResults.push({
              tool_call_id: toolCall.id,
              result,
            });
          } catch (err) {
            toolResults.push({
              tool_call_id: toolCall.id,
              result: JSON.stringify({ error: "Tool execution failed" }),
            });
          }
        }

        conversationMessages.push({
          role: "user",
          content: JSON.stringify(toolResults),
        });

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
