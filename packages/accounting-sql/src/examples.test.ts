import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sqlExamples } from './examples.js';

describe('sql examples', () => {
  it('provides at least 6 FB 2.5-safe examples including issimple fix', () => {
    const examples = sqlExamples({ companyKey: 1, chartRootId: 1 });
    assert.ok(examples.length >= 6);
    assert.ok(examples.every((e) => e.firebird === '2.5+'));
    const corr = examples.find((e) => e.id === 'ex-correspondence-issimple');
    assert.ok(corr);
    assert.match(corr!.sql, /issimple/);
    assert.doesNotMatch(corr!.sql, /WITH RECURSIVE/i);
  });
});
