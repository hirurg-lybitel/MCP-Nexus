import { ChatCompletionFunctionTool } from "openai/resources";

export enum GptFunctionName {
  Planning = 'initialize_plan',
  Horoscope = 'get_horoscope',
}

export const GptFunctions: Array<ChatCompletionFunctionTool> = [
  {
    type: "function",
    function: {
      name: GptFunctionName.Planning,
      description: "Initializes a step-by-step plan for executing a task. Call this tool FIRST if a task requires multiple steps.",
      parameters: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "Unique step ID or tool name (e.g. 'get_temp')" },
                label: { type: "string", description: "User-friendly description (e.g. 'Get temperature')" }
              },
              required: ["id", "label"]
            },
            description: "List of all steps to complete a request"
          }
        },
        required: ["steps"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: GptFunctionName.Horoscope,
      description: "Get today's horoscope for an astrological sign.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name of the user"
          },
          sign: {
            type: "string",
            description: "An astrological sign like Taurus or Aquarius",
          },
          sex: {
            type: "string",
            enum: ["male", "female"],
          },
        },
        required: ["sign", "name", "sex"],
      },
    }
  }  
];