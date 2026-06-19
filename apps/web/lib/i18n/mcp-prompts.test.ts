import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getQueryTableUserMessage,
  getTemperaturePrompt,
} from './mcp-prompts';

describe('mcp-prompts locale', () => {
  it('returns English by default', () => {
    const text = getQueryTableUserMessage(undefined, 'GD_GOOD', 10);
    assert.ok(text.startsWith('Show the top 7 product groups'));
  });

  it('returns Russian when locale is ru', () => {
    const text = getQueryTableUserMessage('ru', 'GD_GOOD', 10);
    assert.ok(text.startsWith('Покажи топ 7 групп товаров'));
  });

  it('returns Belarusian when locale is by', () => {
    const text = getQueryTableUserMessage('by', 'GD_GOOD', 10);
    assert.ok(text.startsWith('Пакажы топ 7 груп тавараў'));
  });

  it('returns localized temperature prompt', () => {
    assert.ok(getTemperaturePrompt('ru').includes('Минске'));
    assert.ok(getTemperaturePrompt('by').includes('Мінску'));
  });
});
