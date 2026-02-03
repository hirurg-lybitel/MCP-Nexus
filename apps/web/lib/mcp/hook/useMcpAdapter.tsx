'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { McpClientAdapter, McpPrompt, McpTool } from '../client';

export const useMcpAdapter = () => {
  const [client, setClient] = useState<McpClientAdapter | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [tools, setTools] = useState<Array<McpTool>>([]);
  const [prompts, setPrompts] = useState<Array<McpPrompt>>([]);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(false);

  const autoConnect = useCallback(async () => {
    if (client || isConnecting) {
      return;
    }
    setIsConnecting(true);

    try {
      const newClient = new McpClientAdapter(window.location.origin + '/api/mcp');
      await newClient.connect();

      setClient(newClient);
      setIsConnected(true);

      const toolsResult = await newClient.listTools();
      const promptsResult = await newClient.listPrompts();

      // Check again before updating state
      if (!isMounted.current) {
        return;
      }

      console.log('Tools:', toolsResult.tools);
      console.log('Prompts:', promptsResult.prompts);

      setTools(
        toolsResult.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
        }))
      );

      setPrompts(
        promptsResult.prompts.map((prompt) => ({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments,
        }))
      );
    } catch (err) {
      // Ignore errors if component is unmounted
      if (!isMounted.current) {
        return;
      }

      console.error('Error connecting to server:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnected(false);
    } finally {
      if (isMounted.current) {
        setIsConnecting(false);
      }
    }
  }, [client, isConnecting]);

  useEffect(() => {
    if (!isMounted.current) {
      autoConnect();

      isMounted.current = true;
    }
  }, [autoConnect]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      console.log('Disconnecting on unmount 1');
      if (!client) {
        return;
      }
      console.log('Disconnecting on unmount 2');
      // Silently disconnect - ignore errors during unmount
      client.disconnect().catch((e) => {
        // Ignore errors during cleanup
        console.log('Failed to disconnect on unmount', e);
      });

      isMounted.current = false;
    };
  }, [client]);

  const callTool = useCallback(async (name: string, args: Record<string, unknown>) => {
    if (!client) {
      console.error('Not connected to mcp server.');
      setError('Not connected to mcp server.');
      return;
    }

    return await client.callTool(name, args);
  }, [client]);

  const getPrompt = useCallback(
    async (name: string, args?: Record<string, unknown>) => {
      if (!client) {
        setError('Not connected to mcp server.');
        throw new Error('Not connected to mcp server.');
      }
      return await client.getPrompt(name, args);
    },
    [client]
  );

  return {
    isConnected,
    isConnecting,
    error,
    tools,
    prompts,
    callTool,
    getPrompt,
  };
};
