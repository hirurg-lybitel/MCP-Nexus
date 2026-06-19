import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DOMAIN_CONTEXT_CHARS } from '@/constants';
import { buildSystemPrompt, truncateDomainContext } from './system-prompt';

describe('buildSystemPrompt', () => {
  it('returns base prompt without user context', () => {
    const prompt = buildSystemPrompt();
    assert.ok(prompt.includes('You are a Firebird data assistant'));
    assert.ok(!prompt.includes('## Domain context'));
    assert.ok(prompt.includes('Always respond in English'));
  });

  it('appends domain context section when provided', () => {
    const context = 'GD_GOOD.GROUP_ID → GD_GROUP.ID';
    const prompt = buildSystemPrompt(context);
    assert.ok(prompt.includes('## Domain context (user-provided'));
    assert.ok(prompt.includes(context));
    assert.ok(
      prompt.indexOf('## Security') < prompt.indexOf('## Domain context')
    );
  });

  it('ignores whitespace-only user context', () => {
    const prompt = buildSystemPrompt('   \n  ');
    assert.ok(!prompt.includes('## Domain context'));
  });

  it('includes Russian response language instruction', () => {
    const prompt = buildSystemPrompt(undefined, 'ru');
    assert.ok(prompt.includes('Всегда отвечай на русском языке'));
  });

  it('includes Belarusian response language instruction', () => {
    const prompt = buildSystemPrompt(undefined, 'by');
    assert.ok(prompt.includes('Заўсёды адказвай на беларускай мове'));
  });

  it('includes Firebird SQL dialect section', () => {
    const prompt = buildSystemPrompt(undefined, 'en', '2.5');
    assert.ok(prompt.includes('## Firebird SQL dialect (2.5)'));
    assert.ok(prompt.includes('UI prepends №'));
    assert.ok(prompt.includes('no WITH (CTE)'));
  });

  it('includes dialect 3 allowances in prompt', () => {
    const prompt = buildSystemPrompt(undefined, 'en', '3');
    assert.ok(prompt.includes('## Firebird SQL dialect (3)'));
    assert.ok(prompt.includes('window functions'));
  });
});

describe('truncateDomainContext', () => {
  it('truncates to MAX_DOMAIN_CONTEXT_CHARS', () => {
    const long = 'x'.repeat(MAX_DOMAIN_CONTEXT_CHARS + 100);
    assert.equal(truncateDomainContext(long).length, MAX_DOMAIN_CONTEXT_CHARS);
  });
});
