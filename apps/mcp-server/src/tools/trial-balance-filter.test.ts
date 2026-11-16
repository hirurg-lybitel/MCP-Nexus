import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAliasFilterTokens } from '../lib/account-alias-filter.js';
import { filterTrialBalanceAccounts } from './trial-balance.js';

describe('filterTrialBalanceAccounts', () => {
  const rows = [
    {
      ACCOUNT_ALIAS: '51',
      BEGIN_DEBIT: '1',
      BEGIN_CREDIT: '0',
      DEBIT: '10',
      CREDIT: '0',
      END_DEBIT: '11',
      END_CREDIT: '0',
      OFFBALANCE: 0,
    },
    {
      ACCOUNT_ALIAS: '001',
      BEGIN_DEBIT: '5',
      BEGIN_CREDIT: '0',
      DEBIT: '0',
      CREDIT: '0',
      END_DEBIT: '5',
      END_CREDIT: '0',
      OFFBALANCE: 1,
    },
    {
      ACCOUNT_ALIAS: '90.01',
      BEGIN_DEBIT: '0',
      BEGIN_CREDIT: '0',
      DEBIT: '100',
      CREDIT: '0',
      END_DEBIT: '100',
      END_CREDIT: '0',
      OFFBALANCE: 0,
    },
    {
      ACCOUNT_ALIAS: '62.4-1',
      BEGIN_DEBIT: '0',
      BEGIN_CREDIT: '2',
      DEBIT: '0',
      CREDIT: '20',
      END_DEBIT: '0',
      END_CREDIT: '22',
      OFFBALANCE: 0,
    },
  ];

  it('hides off-balance by default and keeps 50-62 range', () => {
    const filtered = filterTrialBalanceAccounts(rows, {
      includeOffBalance: false,
      aliasTokens: parseAliasFilterTokens(['50-62']),
    });
    assert.deepEqual(
      filtered.map((r) => r.ACCOUNT_ALIAS),
      ['51', '62.4-1']
    );
  });

  it('can include off-balance when requested', () => {
    const filtered = filterTrialBalanceAccounts(rows, {
      includeOffBalance: true,
      aliasTokens: [],
    });
    assert.equal(filtered.length, 4);
  });
});
