'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { McpClientAdapter, McpPrompt, McpTool } from '../client';
import { useMcpKeyStore } from '@/stores/useMcpKeyStore';

export const useMcpAdapter = () => {
  const { mcpKey, isValidated } = useMcpKeyStore();
  const [client, setClient] = useState<McpClientAdapter | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [tools, setTools] = useState<Array<McpTool>>([]);
  const [prompts, setPrompts] = useState<Array<McpPrompt>>([]);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState<boolean | null>(null);
  const clientRef = useRef<McpClientAdapter | null>(null);

  const canConnect =
    authRequired === false || (authRequired === true && isValidated && Boolean(mcpKey));

  const disconnectClient = useCallback(async () => {
    const active = clientRef.current;
    if (!active) {
      return;
    }
    clientRef.current = null;
    setClient(null);
    setIsConnected(false);
    setTools([]);
    setPrompts([]);
    await active.disconnect().catch(() => undefined);
  }, []);

  const connectClient = useCallback(async () => {
    if (!canConnect || isConnecting || clientRef.current) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const authToken = authRequired ? mcpKey : undefined;
      const newClient = new McpClientAdapter(
        `${window.location.origin}/api/mcp`,
        { authToken }
      );
      await newClient.connect();

      const toolsResult = await newClient.listTools();
      const promptsResult = await newClient.listPrompts();

      clientRef.current = newClient;
      setClient(newClient);
      setIsConnected(true);
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
      console.error('Error connecting to server:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnected(false);
      await disconnectClient();
    } finally {
      setIsConnecting(false);
    }
  }, [authRequired, canConnect, disconnectClient, isConnecting, mcpKey]);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/settings/mcp-auth-status')
      .then((response) => response.json())
      .then((data: { authRequired?: boolean }) => {
        if (!cancelled) {
          setAuthRequired(Boolean(data.authRequired));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthRequired(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authRequired === null) {
      return;
    }

    if (canConnect) {
      void connectClient();
      return;
    }

    void disconnectClient();
    if (authRequired) {
      setError('MCP access key is required. Verify your key in Settings.');
    } else {
      setError(null);
    }
  }, [authRequired, canConnect, connectClient, disconnectClient]);

  useEffect(() => {
    return () => {
      void disconnectClient();
    };
  }, [disconnectClient]);

  const callTool = useCallback(
    async (name: string, args: Record<string, unknown>) => {
      if (!clientRef.current) {
        const message = 'Not connected to MCP server.';
        setError(message);
        throw new Error(message);
      }

      return await clientRef.current.callTool(name, args);
    },
    []
  );

  const getPrompt = useCallback(
    async (name: string, args?: Record<string, unknown>) => {
      if (!clientRef.current) {
        const message = 'Not connected to MCP server.';
        setError(message);
        throw new Error(message);
      }
      return await clientRef.current.getPrompt(name, args);
    },
    []
  );

  return {
    isConnected,
    isConnecting,
    authRequired: authRequired ?? true,
    mcpKeyVerified: isValidated && Boolean(mcpKey),
    error,
    tools,
    prompts,
    callTool,
    getPrompt,
  };
};
