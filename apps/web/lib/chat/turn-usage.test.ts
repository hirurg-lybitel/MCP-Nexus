import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TurnUsageAccumulator, parseApiUsage } from './turn-usage';
import { formatTurnUsageLine } from '@/components/TurnUsageFooter';

describe('parseApiUsage', () => {
  it('parses OpenAI usage object', () => {
    assert.deepEqual(
      parseApiUsage({
        prompt_tokens: 100,
        completion_tokens: 20,
        total_tokens: 120,
      }),
      {
        promptTokens: 100,
        completionTokens: 20,
        totalTokens: 120,
      }
    );
  });

  it('parses cached token details', () => {
    assert.deepEqual(
      parseApiUsage({
        prompt_tokens: 200,
        completion_tokens: 10,
        total_tokens: 210,
        prompt_tokens_details: { cached_tokens: 50 },
      }),
      {
        promptTokens: 200,
        completionTokens: 10,
        totalTokens: 210,
        cachedTokens: 50,
      }
    );
  });
});

describe('TurnUsageAccumulator', () => {
  it('sums usage across LLM rounds and counts tools', () => {
    const acc = new TurnUsageAccumulator();

    acc.recordApiUsage(
      { prompt_tokens: 1000, completion_tokens: 50, total_tokens: 1050 },
      'gpt-4.1-mini'
    );
    acc.recordApiUsage(
      { prompt_tokens: 2000, completion_tokens: 100, total_tokens: 2100 },
      'gpt-4.1-mini'
    );
    acc.recordToolCall('execute_sql');
    acc.recordToolCall('execute_sql');
    acc.recordToolCall('present_query_result');

    const meta = acc.build('gpt-4.1-mini');

    assert.equal(meta.usage.promptTokens, 3000);
    assert.equal(meta.usage.completionTokens, 150);
    assert.equal(meta.resources.llmRoundCount, 2);
    assert.equal(meta.resources.toolCallCount, 3);
    assert.equal(meta.resources.toolCallsByName.execute_sql, 2);
    assert.ok(meta.estimatedCostUsd > 0);
  });
});

describe('formatTurnUsageLine', () => {
  it('formats cost and token counts', () => {
    const line = formatTurnUsageLine({
      model: 'gpt-4.1-mini',
      usage: {
        promptTokens: 3840,
        completionTokens: 210,
        totalTokens: 4050,
      },
      estimatedCostUsd: 0.0023,
      resources: {
        llmRoundCount: 2,
        toolCallCount: 3,
        toolCallsByName: {
          execute_sql: 2,
          present_query_result: 1,
        },
      },
      pricingNote: 'test',
    }, 'en-US');

    assert.equal(line, '≈ $0.0023 in/out 3 840/210');
  });
});
