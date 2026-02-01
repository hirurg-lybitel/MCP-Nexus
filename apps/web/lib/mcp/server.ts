// import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { z } from "zod";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import type { Request, Response } from 'express';
import { GetPromptResult, isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

export function startMcpServer(port: number) {
  const server = new McpServer({
    name: "mock-mcp-server",
    version: "1.0.0",
    description: "A mock MCP server for testing purposes.",
    title: "Mock MCP Server",
  }, {
    capabilities: { 
      tools: {},
      logging: {}, 
      tasks: { requests: { tools: { call: {} } } },
      prompts: {
        listChanged: true
      }
    },
  });

  // Register a simple tool
  server.registerTool(
    'get_forecast',
    {
      description: 'Get current weather for a location. Use this to check weather conditions for any city.',
      inputSchema: {
        city: z.string().describe('City'),
      },
    },
    async ({ city }) => {
      console.log('[DEBUG] MCP get_forecast', city);
      return {
        content: [{ type: 'text', text: JSON.stringify({ message: `Forecast for ${city} is sleet and a gentle breeze. It's cloudy.` }) }],
      };
    }
  );

  server.registerTool(
    'get_current_temperature',
    {
      description: 'Get current temperature for a location. Use this to check temperature conditions for any city.',
      inputSchema: {
        city: z.string().describe('City'),
        unit: z.enum(['celsius', 'fahrenheit']).default('celsius').optional().describe('Temperature unit'),
      },
      outputSchema: {
        temperature: z.number().describe('Temperature in degrees'),
        unit: z.enum(['celsius', 'fahrenheit']).describe('Temperature unit'),
      },
    },
    async ({ city, unit }) => {
      // some api for getting current temperature in city
      return {
        content: [{ type: 'text', text: JSON.stringify({ temperature: 20, unit }) }],
        structuredContent: {
          temperature: 20,
          unit
        }
      };
    }
  );

  server.registerTool(
    'get_rain_probability',
    {
      description: 'et the probability of rain for a specific location.',
      inputSchema: {
        city: z.string().describe('City'),
        date: z.string().describe('Date in UTC format'),
      },
      outputSchema: {
        probability: z.number().describe('Rain probability in percentage'),
      },
    },
    async ({ city, date }) => {
      console.log('[DEBUG] MCP get_rain_probability', city, date);
      // some api for getting current temperature in city
      return {
        content: [{ type: 'text', text: JSON.stringify({ probability: 20 }) }],
        structuredContent: {
          probability: 20
        }
      };
    }
  );

  server.registerPrompt(
    'get_basic_prompt',
    {
      description: 'Example of a basic complex prompt',
      title: 'Basic Prompt',
    },
    async () => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Show me the full forecast with temperature, chance of precipitation, cloud cover, etc. in London'
            }
          }
        ]
      };
    }
  );

  // server.registerPrompt(
  //   'greeting-template',
  //   {
  //     title: 'Greeting Template',
  //     description: 'A simple greeting prompt template',
  //     argsSchema: {
  //       name: z.string().describe('Name to include in greeting')
  //     }
  //   },
  //   async (args): Promise<GetPromptResult> => {
  //     console.log('[DEBUG] MCP prompt greeting-template', args);
  //     return {
  //       messages: [
  //         {
  //           role: 'user',
  //           content: {
  //             type: 'text',
  //             text: `Please greet ${args.name} in a friendly manner and add a sign BigTeam in the end of the message.`
  //           }
  //         }
  //       ]
  //     };
  //   }
  // );

  // server.registerPrompt(
  //   'get_forecast',
  //   {
  //     title: 'Get current weather for a location',
  //     description: 'Get current weather for a location. Use this to check weather conditions for any city.',
  //     argsSchema: {
  //       city: z.string().describe('City')
  //     }
  //   },
  //   async ({ city }) => {
  //     console.log('[DEBUG] MCP prompt get_forecast', city);
  //     return {
  //       messages: [{
  //         role: 'user',
  //         content: { type: 'text', text: "text of forecast prompt" },
  //       }]
  //     };
  //   }
  // );

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
    console.log('Request body:', req.body);
    if (sessionId) {
      console.log(`Received MCP request for session: ${sessionId}`);
    }

    try {
      let transport: StreamableHTTPServerTransport;
      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else {

        const initializeRequest = isInitializeRequest(req.body);
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
      process.exit(1);
    }
    console.log(`MCP Streamable HTTP Server listening on port ${port}`);
  });
}