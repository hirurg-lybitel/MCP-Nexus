import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimateUsageCostUsd, formatCostUsd } from './model-pricing';

describe('estimateUsageCostUsd', () => {
  it('calculates gpt-5.4-mini cost from prompt and completion tokens', () => {
    const cost = estimateUsageCostUsd('gpt-5.4-mini', {
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
      totalTokens: 2_000_000,
    });
    assert.equal(cost, 0.75 + 4.5);
  });

  it('calculates gpt-5.4 cost from prompt and completion tokens', () => {
    const cost = estimateUsageCostUsd('gpt-5.4', {
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
      totalTokens: 2_000_000,
    });
    assert.equal(cost, 2.5 + 15.0);
  });

  it('calculates gpt-5-mini cost from prompt and completion tokens', () => {
    const cost = estimateUsageCostUsd('gpt-5-mini', {
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
      totalTokens: 2_000_000,
    });
    assert.equal(cost, 0.25 + 2.0);
  });

  it('calculates gpt-4.1-mini cost from prompt and completion tokens', () => {
    const cost = estimateUsageCostUsd('gpt-4.1-mini', {
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
      totalTokens: 2_000_000,
    });
    assert.equal(cost, 0.4 + 1.6);
  });

  it('applies cached input rate for cached tokens', () => {
    const cost = estimateUsageCostUsd('gpt-4.1-mini', {
      promptTokens: 1_000_000,
      completionTokens: 0,
      totalTokens: 1_000_000,
      cachedTokens: 500_000,
    });
    // 500k billable input @ $0.40 + 500k cached @ $0.10
    assert.equal(cost, 0.2 + 0.05);
  });

  it('returns zero for unknown models', () => {
    assert.equal(
      estimateUsageCostUsd('unknown-model', {
        promptTokens: 1000,
        completionTokens: 1000,
        totalTokens: 2000,
      }),
      0
    );
  });
});

describe('formatCostUsd', () => {
  it('formats small costs with extra precision', () => {
    assert.equal(formatCostUsd(0.0023), '$0.0023');
  });
});
