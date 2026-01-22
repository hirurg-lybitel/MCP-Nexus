// import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { z } from "zod";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import type { Request, Response } from 'express';
import { GetPromptResult, isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

export function startMcpServer(port = 4005) {
  // Создаём MCP сервер
  const server = new McpServer({
    name: "mock-mcp-server",
    version: "1.0.0",
  }, {
    capabilities: { logging: {}, tasks: { requests: { tools: { call: {} } } } },
  });

  // Регистрируем минимальный mock tool
  server.registerTool(
    'mcp_get_forecast',
    {
      description: 'Get forecast by city',
      inputSchema: {
        city: z.string().describe('City'),
      },
    },
    async ({ city }) => {
      console.log('[DEBUG] MCP get_forecast', city);
      return {
        content: [{ type: 'text', text: JSON.stringify({ message: `Forecast for ${city} is 200 degrees` }) }],
      };
    }
  );

  // Register a simple prompt with title
  server.registerPrompt(
    'greeting-template',
    {
        title: 'Greeting Template',
        description: 'A simple greeting prompt template',
        argsSchema: {
            name: z.string().describe('Name to include in greeting')
        }
    },
    async ({ name }): Promise<GetPromptResult> => {
        return {
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: `Please greet ${name} in a friendly manner and add a sign BigTeam in the end of the message.`
                    }
                }
            ]
        };
    }
);

  const app = createMcpExpressApp();

  // CORS middleware
  app.use((req: Request, res: Response, next) => {
    const origin = req.headers.origin;
    
    // Allow requests from localhost on any port (for development)
    if (origin && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-protocol-version, mcp-session-id, last-event-id, authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id, content-type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    next();
  });

  const mcpPostHandler = async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId) {
        console.log(`Received MCP request for session: ${sessionId}`);
    } else {
        console.log('Request body:', req.body);
    }

    try {
      let transport: StreamableHTTPServerTransport;
      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else {

        const initializeRequest = isInitializeRequest(req.body);
        console.log('Initialize request:', initializeRequest);
        if (!initializeRequest) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
                code: -32_000,
                message: 'Bad Request: No valid session ID provided'
            },
            id: null
        });
        return;
        }

        const eventStore = new InMemoryEventStore();

        
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
          onsessioninitialized: (sessionId) => {
            console.log(`Session initialized with ID: ${sessionId}`);
            transports[sessionId] = transport;
          },
          eventStore
        });

        // Set up onclose handler to clean up transport when closed
        transport.onclose = () => {
          console.log('Transport closed');
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
              console.log(`Transport closed for session ${sid}, removing from transports map`);
              delete transports[sid];
          }
        };

        await server.connect(transport);
        console.log('Transport connected');
        await transport.handleRequest(req, res, req.body);
        console.log('Transport handled');
        return;
      }
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
    }
  };

  const mcpGetHandler = async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
    }

    // Check for Last-Event-ID header for resumability
    const lastEventId = req.headers['last-event-id'] as string | undefined;
    if (lastEventId) {
        console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
    } else {
        console.log(`Establishing new SSE stream for session ${sessionId}`);
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
};

const mcpDeleteHandler = async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
  }

  console.log(`Received session termination request for session ${sessionId}`);

  try {
      const transport = transports[sessionId];
      await transport.handleRequest(req, res);
  } catch (error) {
      console.error('Error handling session termination:', error);
      if (!res.headersSent) {
          res.status(500).send('Error processing session termination');
      }
  }
};

  // Handle OPTIONS for all routes
  app.options('/mcp', (req: Request, res: Response) => {
    res.status(200).end();
  });

  app.post('/mcp', mcpPostHandler);
  app.get('/mcp', mcpGetHandler);
  app.delete('/mcp', mcpDeleteHandler);

  app.listen(port, error => {
    if (error) {
        console.error('Failed to start server:', error);
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(1);
    }
    console.log(`MCP Streamable HTTP Server listening on port ${port}`);
  });
}