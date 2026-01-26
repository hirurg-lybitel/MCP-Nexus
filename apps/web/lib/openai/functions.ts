import { ChatCompletionFunctionTool } from "openai/resources";

export enum GptFunctionName {
    Horoscope = 'get_horoscope',
}

export const GptFunctions: Array<ChatCompletionFunctionTool> = [
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
  },
];