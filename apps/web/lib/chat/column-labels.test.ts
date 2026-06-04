import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  labelForColumn,
  normalizeColumnLabels,
  prettifyFieldKey,
} from './column-labels';

describe('labelForColumn', () => {
  it('prefers metadata or agent labels over prettified key', () => {
    assert.equal(
      labelForColumn('NAME', { NAME: 'Наименование' }),
      'Наименование'
    );
    assert.equal(labelForColumn('PRODUCTCOUNT', undefined), 'PRODUCTCOUNT');
  });
});

describe('prettifyFieldKey', () => {
  it('splits underscores and camelCase', () => {
    assert.equal(prettifyFieldKey('PRODUCT_COUNT'), 'PRODUCT COUNT');
  });
});

describe('normalizeColumnLabels', () => {
  it('parses string map', () => {
    assert.deepEqual(normalizeColumnLabels({ A: ' Alpha ' }), { A: 'Alpha' });
  });
});
