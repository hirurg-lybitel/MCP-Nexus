import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { ListToolsResult } from '@modelcontextprotocol/sdk/types.js';

export type { Tool as McpTool } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP Client Adapter for browser
 * 
 * Simple adapter based on the official example from:
 * https://github.com/modelcontextprotocol/typescript-sdk/blob/main/examples/client/src/simpleStreamableHttp.ts
 */
export class McpClientAdapter {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private readonly serverUrl: string;
  private isDisconnecting: boolean = false;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  /**
   * Connect to MCP server
   */
  async connect(): Promise<void> {
    if (this.client) {
      throw new Error('Already connected. Disconnect first.');
    }

    try {
      // Create a new client
      this.client = new Client(
        {
          name: 'web-client',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      // Set up error handler - ignore errors during normal disconnection
      this.client.onerror = (error) => {
        // Ignore errors related to normal disconnection
        console.log('Disconnection error:', { isDisconnecting: this.isDisconnecting, error });
        if (this.isDisconnecting) {
          return;
        }
        
        // Ignore SSE stream disconnection errors (normal when closing)
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorName = error instanceof Error ? error.name : '';
        
        if (errorMessage.includes('SSE stream disconnected') || 
            errorMessage.includes('AbortError') ||
            errorMessage.includes('BodyStreamBuffer was aborted') ||
            errorMessage.includes('signal is aborted') ||
            errorMessage.includes('signal is aborted without reason') ||
            errorName === 'AbortError') {
          return;
        }
        
        console.error('MCP Client error:', error);
      };

      // Create transport
      this.transport = new StreamableHTTPClientTransport(new URL(this.serverUrl));

      // Connect the client
      await this.client.connect(this.transport);
      console.log('Connected to MCP server');
    } catch (error) {
      console.error('Failed to connect:', error);
      this.client = null;
      this.transport = null;
      throw error;
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.client || !this.transport) {
      return;
    }

    if (this.isDisconnecting) {
      return;
    }

    console.log('Disconnecting from MCP server', {
      client: this.client,
      transport: this.transport,
      isDisconnecting: this.isDisconnecting,
    });

    // Set flag before closing to ignore errors during disconnection
    this.isDisconnecting = true;
    
    try {
      if (this.transport.sessionId) {
        await this.transport.terminateSession();
      }
      await this.transport.close();
      this.client = null;
      this.transport = null;
      console.log('Disconnected from MCP server');
    } catch (error) {
      // Don't log errors during disconnection - they're expected
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : '';
      if (!errorMessage.includes('signal is aborted') && 
          !errorMessage.includes('AbortError') &&
          errorName !== 'AbortError') {
        console.error('Error disconnecting:', error);
      }
    } finally {
      // Reset flag after a short delay to catch any delayed async errors
      setTimeout(() => {
        this.isDisconnecting = false;
      }, 200);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client !== null && this.transport !== null;
  }

  /**
   * List available tools
   */
  async listTools(): Promise<ListToolsResult> {
    if (!this.client) {
      throw new Error('Not connected to server.');
    }

    try {
      const result = await this.client.listTools();
      return result;
    } catch (error) {
      // Don't log errors if we're disconnecting (connection closed is expected)
      if (this.isDisconnecting) {
        throw error;
      }
      
      // Check if it's a connection closed error - don't log these as they're expected during cleanup
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Connection closed') || 
          errorMessage.includes('MCP error -32000')) {
        throw error; // Re-throw but don't log
      }
      
      console.error('Error listing tools:', error);
      throw error;
    }
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client) {
      throw new Error('Not connected to server.');
    }

    try {
      const result = await this.client.callTool({
        name,
        arguments: args
      });
      return result;
    } catch (error) {
      console.error(`Error calling tool ${name}:`, error);
      throw error;
    }
  }
}
