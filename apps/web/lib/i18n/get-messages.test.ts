import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { translate } from './get-messages';

describe('translate', () => {
  it('resolves nested keys for English', () => {
    assert.equal(translate('en', 'navigation.chat'), 'Chat');
  });

  it('interpolates variables', () => {
    assert.equal(
      translate('en', 'tools.using', { tool: 'Execute Sql' }),
      'Using: Execute Sql'
    );
  });

  it('falls back to English for missing keys', () => {
    assert.equal(translate('by', 'navigation.chat'), 'Чат');
  });

  it('returns Russian chat thinking label', () => {
    assert.equal(translate('ru', 'chat.thinking'), 'Думаю...');
  });
});
