'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { McpClientAdapter } from '@/lib/mcp/client';
import Button from './basic/Button';
import { useMcpAdapter } from '@/lib/mcp/hook/useMcpAdapter';

export default function McpTools() {
  const [client, setClient] = useState<McpClientAdapter | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [tools, setTools] = useState<
    Array<{
      name: string;
      description?: string;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('http://localhost:4005/mcp');
  const isMountedRef = useRef(true);
  const isMounted = useRef(false);

  const autoConnect = useCallback(async () => {
    if (client || isConnecting) {
      return;
    }
    setIsConnecting(true);

    try {
      const newClient = new McpClientAdapter(serverUrl);
      await newClient.connect();

      const res = newClient.isConnected();
      console.log('[ comp ] isConnected', res);

      setClient(newClient);
      setIsConnected(true);

      const result = await newClient.listTools();

      // Check again before updating state
      if (!isMountedRef.current) {
        return;
      }

      console.log('Tools:', result.tools);
      setTools(
        result.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
        }))
      );
    } catch (err) {
      // Ignore errors if component is unmounted
      if (!isMountedRef.current) {
        return;
      }

      console.error('Error connecting to server:', err);
      setIsConnected(false);
    } finally {
      if (isMountedRef.current) {
        setIsConnecting(false);
      }
    }
  }, [client, isConnecting, serverUrl]);

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
    };
  }, [client]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const newClient = new McpClientAdapter(serverUrl);
      await newClient.connect();
      setClient(newClient);
      setIsConnected(true);

      // Fetch tools immediately after connection
      await fetchTools(newClient);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      if (client) {
        await client.disconnect();
      }
      setClient(null);
      setIsConnected(false);
      setTools([]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  const fetchTools = async (mcpClient?: McpClientAdapter) => {
    const clientToUse = mcpClient || client;
    if (!clientToUse) {
      if (isMountedRef.current) {
        setError('Not connected to server');
      }
      return;
    }

    try {
      const result = await clientToUse.listTools();

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) {
        return;
      }

      setTools(
        result.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
        }))
      );
      setError(null);
    } catch (err) {
      // Ignore "Connection closed" errors if component is unmounting
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('Connection closed') && !isMountedRef.current) {
        return;
      }

      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch tools');
      }
    }
  };

  // const { error, tools, isConnecting, isConnected } = useMcpAdapter();

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label
            htmlFor="server-url"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            MCP Server URL
          </label>
          {/* <input
            id="server-url"
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            disabled={isConnected}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50"
            placeholder="http://localhost:4005/mcp"
          /> */}
        </div>
        {/* {!isConnected ? (
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            variant="primary"
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </Button>
        ) : (
          <Button
            onClick={handleDisconnect}
            variant="secondary"
          >
            Disconnect
          </Button>
        )} */}
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {isConnected && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Available Tools ({tools.length})
            </h3>
            {/* <Button
              onClick={() => fetchTools()}
              variant="secondary"
              className="text-sm"
            >
              Refresh
            </Button> */}
          </div>

          {tools.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No tools available
            </p>
          ) : (
            <div className="space-y-2">
              {tools.map((tool) => (
                <div
                  key={tool.name}
                  className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    {tool.name}
                  </div>
                  {tool.description && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {tool.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!isConnected && isConnecting === false && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Connect to MCP server to view available tools
        </p>
      )}
    </div>
  );
}
