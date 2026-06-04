import { ChatCompletionFunctionTool } from 'openai/resources';
import { AgentFunctions } from '@/lib/agent/functions';

export enum GptFunctionName {
  Horoscope = 'get_horoscope',
}

/** Host agent tools (UI + demo). Firebird data tools come from MCP. */
export const GptFunctions: Array<ChatCompletionFunctionTool> = [
  ...AgentFunctions,
  {
    type: 'function',
    function: {
      name: GptFunctionName.Horoscope,
      description: "Get today's horoscope for an astrological sign.",
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the user',
          },
          sign: {
            type: 'string',
            description: 'An astrological sign like Taurus or Aquarius',
          },
          sex: {
            type: 'string',
            enum: ['male', 'female'],
          },
        },
        required: ['sign', 'name', 'sex'],
      },
    },
  },
];
