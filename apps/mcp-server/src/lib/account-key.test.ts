import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveAccountKey } from './account-key.js';

function mockDb(rows: unknown[]) {
  return {
    executeSql: {
      run: async () => ({ rows }),
    },
  };
}

describe('resolveAccountKey', () => {
  it('rejects alias-like ids that are missing from AC_ACCOUNT', async () => {
    const result = await resolveAccountKey(mockDb([]), 62);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'ACCOUNT_NOT_FOUND');
    assert.match(result.message, /find_account|alias/i);
  });

  it('accepts a real account id', async () => {
    const result = await resolveAccountKey(
      mockDb([{ ID: 366200, ALIAS: '62', NAME: 'Расчеты с покупателями' }]),
      366200
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.accountKey, 366200);
    assert.equal(result.alias, '62');
  });
});
