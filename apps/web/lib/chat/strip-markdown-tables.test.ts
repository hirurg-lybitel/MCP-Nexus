import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldStripTablesAfterPresentation,
  stripMarkdownTables,
} from './strip-markdown-tables';

describe('stripMarkdownTables', () => {
  it('removes pipe tables', () => {
    const input = `Вот результат:

| A | B |
|---|---|
| 1 | 2 |

Краткий вывод.`;
    const out = stripMarkdownTables(input, 'ru');
    assert.ok(!out.includes('|'));
    assert.ok(out.includes('Краткий вывод'));
  });
});

describe('shouldStripTablesAfterPresentation', () => {
  it('true for assistant text after table in same turn', () => {
    const messages = [
      { role: 'user', content: 'q' },
      { role: 'assistant', tableData: { columns: [], rows: [] } },
      { role: 'assistant', content: '| a |' },
    ];
    assert.equal(shouldStripTablesAfterPresentation(messages, 2), true);
  });

  it('false after new user message', () => {
    const messages = [
      { role: 'assistant', tableData: { columns: [], rows: [] } },
      { role: 'user', content: 'q2' },
      { role: 'assistant', content: '| a |' },
    ];
    assert.equal(shouldStripTablesAfterPresentation(messages, 2), false);
  });
});
