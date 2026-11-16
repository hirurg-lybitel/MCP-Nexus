import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aliasMatchesFilter,
  aliasMatchesPrefix,
  parseAliasFilterToken,
  parseAliasFilterTokens,
  parseAliasRoot,
  rowAlias,
  rowOffbalance,
} from './account-alias-filter.js';

describe('account alias filter', () => {
  it('parses alias roots', () => {
    assert.equal(parseAliasRoot('62.4-1'), 62);
    assert.equal(parseAliasRoot('51-15'), 51);
    assert.equal(parseAliasRoot('90'), 90);
    assert.equal(parseAliasRoot(''), null);
  });

  it('matches prefixes including dotted/dashed children', () => {
    assert.equal(aliasMatchesPrefix('51', '51'), true);
    assert.equal(aliasMatchesPrefix('51-1', '51'), true);
    assert.equal(aliasMatchesPrefix('51.2', '51'), true);
    assert.equal(aliasMatchesPrefix('510', '51'), false);
    assert.equal(aliasMatchesPrefix('52', '51'), false);
  });

  it('parses range tokens', () => {
    assert.deepEqual(parseAliasFilterToken('50-62'), {
      kind: 'range',
      from: 50,
      to: 62,
    });
    assert.deepEqual(parseAliasFilterToken('60'), {
      kind: 'prefix',
      value: '60',
    });
  });

  it('matches B5-style 50-62 range', () => {
    const tokens = parseAliasFilterTokens(['50-62']);
    assert.equal(aliasMatchesFilter('50', tokens), true);
    assert.equal(aliasMatchesFilter('51-15', tokens), true);
    assert.equal(aliasMatchesFilter('57.3', tokens), true);
    assert.equal(aliasMatchesFilter('60.1', tokens), true);
    assert.equal(aliasMatchesFilter('62.4-6', tokens), true);
    assert.equal(aliasMatchesFilter('68.3', tokens), false);
    assert.equal(aliasMatchesFilter('90.01', tokens), false);
    assert.equal(aliasMatchesFilter('001', tokens), false);
  });

  it('matches explicit prefix lists', () => {
    const tokens = parseAliasFilterTokens(['50', '51', '60', '62']);
    assert.equal(aliasMatchesFilter('51-1', tokens), true);
    assert.equal(aliasMatchesFilter('57', tokens), false);
    assert.equal(aliasMatchesFilter('60.5', tokens), true);
  });

  it('reads alias/offbalance from mixed row shapes', () => {
    assert.equal(rowAlias({ ACCOUNT_ALIAS: '51-1' }), '51-1');
    assert.equal(rowAlias({ account_alias: '60' }), '60');
    assert.equal(rowOffbalance({ OFFBALANCE: 1 }), 1);
    assert.equal(rowOffbalance({ offbalance: 0 }), 0);
    assert.equal(rowOffbalance({ OFFBALANCE: '1' }), 1);
  });
});
