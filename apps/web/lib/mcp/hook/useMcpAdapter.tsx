import { useCallback, useEffect, useRef, useState } from "react";
import { McpClientAdapter, McpTool } from "../client";

const serverUrl = 'http://localhost:4005';

export const useMcpAdapter = () => {
  const [client, setClient] = useState<McpClientAdapter | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [tools, setTools] = useState<Array<McpTool>>([]);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(false);

  const autoConnect = useCallback(async () => {
    if (client || isConnecting) {
      return;
    }
    setIsConnecting(true);

    try {
      const newClient = new McpClientAdapter(serverUrl);
      await newClient.connect();

      setClient(newClient);
      setIsConnected(true);

      const result = await newClient.listTools();

      // Check again before updating state
      if (!isMounted.current) {
        return;
      }

      console.log('Tools:', result.tools);
      setTools(
        result.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema
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
        setError(e instanceof Error ? e.message : 'Failed to disconnect');
      });
    };
  }, [client]);

  return {
    isConnected,
    isConnecting,
    error,
    tools
  };
};