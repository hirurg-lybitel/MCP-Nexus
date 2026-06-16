import type { ApiUsageSlice } from './turn-usage';

/** USD per 1M tokens — OpenAI list prices (https://developers.openai.com/api/docs/pricing). */
export interface ModelPricingRates {
  inputPer1M: number;
  outputPer1M: number;
  cachedInputPer1M: number;
}

const MODEL_PRICING: Record<string, ModelPricingRates> = {
  'gpt-4.1-mini': {
    inputPer1M: 0.4,
    outputPer1M: 1.6,
    cachedInputPer1M: 0.1,
  },
  'gpt-5-mini': {
    inputPer1M: 0.25,
    outputPer1M: 2.0,
    cachedInputPer1M: 0.025,
  },
  'gpt-5.4': {
    inputPer1M: 2.5,
    outputPer1M: 15.0,
    cachedInputPer1M: 0.25,
  },
  'gpt-5.4-mini': {
    inputPer1M: 0.75,
    outputPer1M: 4.5,
    cachedInputPer1M: 0.075,
  },
};

export const PRICING_NOTE_KNOWN =
  'Estimated from OpenAI list price; excludes proxy markup.';
export const PRICING_NOTE_UNKNOWN =
  'Token usage recorded; model pricing unknown — cost not estimated.';

export function getModelPricingRates(model: string): ModelPricingRates | null {
  return MODEL_PRICING[model] ?? null;
}

export function estimateUsageCostUsd(
  model: string,
  usage: ApiUsageSlice
): number {
  const rates = getModelPricingRates(model);
  if (!rates) {
    return 0;
  }

  const cached = usage.cachedTokens ?? 0;
  const billableInput = Math.max(0, usage.promptTokens - cached);

  const inputCost = (billableInput / 1_000_000) * rates.inputPer1M;
  const cachedCost = (cached / 1_000_000) * rates.cachedInputPer1M;
  const outputCost = (usage.completionTokens / 1_000_000) * rates.outputPer1M;

  return inputCost + cachedCost + outputCost;
}

export function formatCostUsd(cost: number): string {
  if (cost === 0) {
    return '$0.00';
  }
  if (cost >= 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  if (cost >= 0.0001) {
    return `$${cost.toFixed(4)}`;
  }
  const digits = Math.max(2, Math.ceil(-Math.log10(cost)) + 2);
  return `$${cost.toFixed(Math.min(digits, 6))}`;
}
