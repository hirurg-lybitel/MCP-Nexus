import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DOMAIN_CONTEXT_CHARS } from '@/constants';
import { buildSystemPrompt, truncateDomainContext } from './system-prompt';

describe('buildSystemPrompt', () => {
  it('returns base prompt without user context', () => {
    const prompt = buildSystemPrompt();
    assert.ok(prompt.includes('You are a Firebird data assistant'));
    assert.ok(!prompt.includes('## Domain context'));
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
});

describe('truncateDomainContext', () => {
  it('truncates to MAX_DOMAIN_CONTEXT_CHARS', () => {
    const long = 'x'.repeat(MAX_DOMAIN_CONTEXT_CHARS + 100);
    assert.equal(truncateDomainContext(long).length, MAX_DOMAIN_CONTEXT_CHARS);
  });
});
