import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import {
  getBasicPrompt,
  getBirthdayCongratulations,
  getGreetingTemplate,
  getRainProbabilityPrompt,
  getTemperaturePrompt,
  LOCALE_ARG_SCHEMA,
} from '@/lib/i18n/mcp-prompts';

const localeSchema = z.enum(LOCALE_ARG_SCHEMA).optional();

const pause = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function registerDemoTools(server: McpServer): void {
  server.registerTool(
    'get_humidity',
    {
      description:
        'Get humidity for a location. Use this to check humidity conditions for any city.',
      inputSchema: {
        city: z.string().describe('City'),
      },
    },
    async ({ city }) => {
      await pause(2000);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ message: `Humidity for ${city} is 50%` }),
          },
        ],
      };
    }
  );

  server.registerTool(
    'get_current_temperature',
    {
      description:
        'Get current temperature for a location. Use this to check temperature conditions for any city.',
      inputSchema: {
        city: z.string().describe('City'),
        unit: z
          .enum(['celsius', 'fahrenheit'])
          .default('celsius')
          .optional()
          .describe('Temperature unit'),
      },
      outputSchema: {
        temperature: z.number().describe('Temperature in degrees'),
        unit: z.enum(['celsius', 'fahrenheit']).describe('Temperature unit'),
      },
    },
    async ({ city, unit }) => {
      await pause(2000);
      return {
        content: [
          { type: 'text', text: JSON.stringify({ temperature: 20, unit }) },
        ],
        structuredContent: {
          temperature: 20,
          unit,
        },
      };
    }
  );

  server.registerTool(
    'get_rain_probability',
    {
      description: 'Get the probability of rain for a specific location.',
      inputSchema: {
        city: z.string().describe('City'),
        date: z.string().describe('Date in UTC format'),
      },
      outputSchema: {
        probability: z.number().describe('Rain probability in percentage'),
      },
    },
    async ({ city, date }) => {
      await pause(2000);
      return {
        content: [{ type: 'text', text: JSON.stringify({ probability: 20 }) }],
        structuredContent: {
          probability: 20,
        },
      };
    }
  );
}

export function registerDemoPrompts(server: McpServer): void {
  server.registerPrompt(
    'get_basic_prompt',
    {
      description: 'Example of a basic complex prompt',
      title: 'Basic Prompt',
      argsSchema: {
        locale: localeSchema.describe('UI language for prompt text (en, ru, by)'),
      },
    },
    async (args) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: getBasicPrompt(args?.locale),
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'get_rain_probability_prompt',
    {
      description: 'A prompt for getting the probability of rain',
      title: 'Rain Probability Prompt',
      argsSchema: {
        locale: localeSchema.describe('UI language for prompt text (en, ru, by)'),
      },
    },
    async (args) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: getRainProbabilityPrompt(args?.locale),
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'get_temperature_prompt',
    {
      description: 'A prompt for getting the temperature',
      title: 'Temperature Prompt',
      argsSchema: {
        locale: localeSchema.describe('UI language for prompt text (en, ru, by)'),
      },
    },
    async (args) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: getTemperaturePrompt(args?.locale),
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'greeting-template',
    {
      title: 'Greeting Template',
      description: 'A simple greeting prompt template',
      argsSchema: {
        name: z.string().describe('Name to include in greeting'),
        locale: localeSchema.describe('UI language for prompt text (en, ru, by)'),
      },
    },
    async (args): Promise<GetPromptResult> => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: getGreetingTemplate(args.locale, args.name),
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'birthday_congratulations',
    {
      title: 'Birthday Congratulations',
      description: 'A prompt for congratulating a person on their birthday',
      argsSchema: {
        name: z.string().describe('Name to congratulate'),
        age: z.string().describe('Age of the person to congratulate'),
        locale: localeSchema.describe('UI language for prompt text (en, ru, by)'),
      },
    },
    async (args): Promise<GetPromptResult> => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: getBirthdayCongratulations(args.locale, args.name, args.age),
          },
        },
      ],
    })
  );
}
