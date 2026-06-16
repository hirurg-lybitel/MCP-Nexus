import {
  estimateUsageCostUsd,
  getModelPricingRates,
  PRICING_NOTE_KNOWN,
  PRICING_NOTE_UNKNOWN,
} from './model-pricing';

export interface ApiUsageSlice {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number;
}

export interface TurnResourceMetrics {
  llmRoundCount: number;
  toolCallCount: number;
  toolCallsByName: Record<string, number>;
}

export interface TurnUsageMeta {
  model: string;
  usage: ApiUsageSlice;
  estimatedCostUsd: number;
  resources: TurnResourceMetrics;
  pricingNote: string;
}

function emptyUsage(): ApiUsageSlice {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
}

export function parseApiUsage(usage: unknown): ApiUsageSlice | null {
  if (!usage || typeof usage !== 'object') {
    return null;
  }

  const record = usage as Record<string, unknown>;
  const promptTokens = Number(record.prompt_tokens);
  const completionTokens = Number(record.completion_tokens);

  if (!Number.isFinite(promptTokens) || !Number.isFinite(completionTokens)) {
    return null;
  }

  const totalRaw = record.total_tokens;
  const totalTokens = Number.isFinite(Number(totalRaw))
    ? Number(totalRaw)
    : promptTokens + completionTokens;

  let cachedTokens: number | undefined;
  const details = record.prompt_tokens_details;
  if (details && typeof details === 'object') {
    const cached = Number((details as Record<string, unknown>).cached_tokens);
    if (Number.isFinite(cached) && cached > 0) {
      cachedTokens = cached;
    }
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    ...(cachedTokens !== undefined ? { cachedTokens } : {}),
  };
}

function mergeUsage(
  target: ApiUsageSlice,
  slice: ApiUsageSlice
): ApiUsageSlice {
  return {
    promptTokens: target.promptTokens + slice.promptTokens,
    completionTokens: target.completionTokens + slice.completionTokens,
    totalTokens: target.totalTokens + slice.totalTokens,
    cachedTokens: (target.cachedTokens ?? 0) + (slice.cachedTokens ?? 0),
  };
}

export class TurnUsageAccumulator {
  private usage: ApiUsageSlice = emptyUsage();
  private llmRoundCount = 0;
  private toolCallsByName: Record<string, number> = {};

  recordApiUsage(usage: unknown, _model: string): void {
    const slice = parseApiUsage(usage);
    if (!slice) {
      return;
    }
    this.usage = mergeUsage(this.usage, slice);
    this.llmRoundCount += 1;
  }

  recordToolCall(toolName: string): void {
    const name = toolName.trim();
    if (!name) {
      return;
    }
    this.toolCallsByName[name] = (this.toolCallsByName[name] ?? 0) + 1;
  }

  build(model: string): TurnUsageMeta {
    const toolCallCount = Object.values(this.toolCallsByName).reduce(
      (sum, count) => sum + count,
      0
    );

    const usage: ApiUsageSlice = {
      ...this.usage,
      ...(this.usage.cachedTokens === 0
        ? { cachedTokens: undefined }
        : {}),
    };

    return {
      model,
      usage,
      estimatedCostUsd: estimateUsageCostUsd(model, usage),
      resources: {
        llmRoundCount: this.llmRoundCount,
        toolCallCount,
        toolCallsByName: { ...this.toolCallsByName },
      },
      pricingNote: getModelPricingRates(model)
        ? PRICING_NOTE_KNOWN
        : PRICING_NOTE_UNKNOWN,
    };
  }
}
