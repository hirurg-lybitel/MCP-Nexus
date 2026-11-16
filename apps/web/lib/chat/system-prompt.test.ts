import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DOMAIN_CONTEXT_CHARS } from '@/constants';
import {
  buildSystemPrompt,
  truncateDomainContext,
  WEB_HOST_TOOLS_SECTION,
} from './system-prompt';

describe('buildSystemPrompt', () => {
  it('uses server instructions when provided (2.10)', () => {
    const prompt = buildSystemPrompt({
      serverInstructions: 'Для ОСВ — get_trial_balance; AC_ENTRY.',
      locale: 'en',
    });
    assert.ok(prompt.includes('## Server instructions'));
    assert.ok(prompt.includes('get_trial_balance'));
    assert.ok(prompt.includes('AC_ENTRY'));
    assert.ok(prompt.includes('Host tools (MCP-Nexus web UI only)'));
    assert.ok(prompt.includes('Always state key totals'));
    assert.ok(!prompt.includes('You are a Firebird data assistant'));
  });

  it('falls back to legacy Firebird prompt without server instructions', () => {
    const prompt = buildSystemPrompt();
    assert.ok(prompt.includes('You are a Firebird data assistant'));
    assert.ok(prompt.includes(WEB_HOST_TOOLS_SECTION.slice(0, 40)));
    assert.ok(!prompt.includes('## Domain context'));
    assert.ok(prompt.includes('Always respond in English'));
  });

  it('appends domain context section when provided', () => {
    const context = 'GD_GOOD.GROUP_ID → GD_GROUP.ID';
    const prompt = buildSystemPrompt(context);
    assert.ok(prompt.includes('## Domain context (user-provided'));
    assert.ok(prompt.includes(context));
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

  it('includes Firebird SQL dialect section for legacy 2.5 override', () => {
    const prompt = buildSystemPrompt(undefined, 'en', '2.5');
    assert.ok(prompt.includes('## Firebird SQL dialect (2.5)'));
    assert.ok(prompt.includes('Legacy dialect 2.5'));
    assert.ok(prompt.includes('no window functions'));
  });

  it('includes Firebird 5 / dialect 3 allowances in prompt', () => {
    const prompt = buildSystemPrompt(undefined, 'en', '3');
    assert.ok(prompt.includes('## Firebird SQL dialect (3)'));
    assert.ok(prompt.includes('window functions'));
    assert.ok(prompt.includes('Firebird 5'));
  });
});

describe('truncateDomainContext', () => {
  it('truncates to MAX_DOMAIN_CONTEXT_CHARS', () => {
    const long = 'x'.repeat(MAX_DOMAIN_CONTEXT_CHARS + 100);
    assert.equal(truncateDomainContext(long).length, MAX_DOMAIN_CONTEXT_CHARS);
  });
});
