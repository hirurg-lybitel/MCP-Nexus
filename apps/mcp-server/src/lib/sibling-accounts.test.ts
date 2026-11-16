import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  accountGroupPrefix,
  findRelatedSiblingAccounts,
  isShortSyntheticAlias,
} from './sibling-accounts.js';

describe('sibling alias helpers', () => {
  it('detects short synthetic aliases', () => {
    assert.equal(isShortSyntheticAlias('51'), true);
    assert.equal(isShortSyntheticAlias('90'), true);
    assert.equal(isShortSyntheticAlias('51-1'), false);
    assert.equal(isShortSyntheticAlias('62.4'), false);
    assert.equal(isShortSyntheticAlias('90.01'), false);
  });

  it('extracts two-digit group prefix', () => {
    assert.equal(accountGroupPrefix('51-1'), '51');
    assert.equal(accountGroupPrefix('90.2-3'), '90');
    assert.equal(accountGroupPrefix('x'), null);
  });
});

describe('findRelatedSiblingAccounts', () => {
  it('returns empty when alias is not a short synthetic code', async () => {
    const db = {
      executeSql: {
        run: async () => {
          throw new Error('should not query');
        },
      },
    };
    const rows = await findRelatedSiblingAccounts(db, {
      accountKey: 355100,
      chartRootId: 300000,
      alias: '51-1',
    });
    assert.deepEqual(rows, []);
  });

  it('loads siblings outside LB/RB with same prefix', async () => {
    const db = {
      executeSql: {
        run: async (sql: string) => {
          assert.match(sql, /STARTING WITH UPPER\('51\.'\)/i);
          assert.match(sql, /NOT \(a\.lb >= root\.lb AND a\.rb <= root\.rb\)/i);
          return {
            rows: [
              {
                ID: 1001,
                ALIAS: '51-1',
                NAME: 'Р/с доп.',
                ACCOUNTTYPE: 'A',
              },
              {
                ID: 1002,
                ALIAS: '51-2',
                NAME: 'Р/с 2',
                ACCOUNTTYPE: 'A',
              },
            ],
          };
        },
      },
    };
    const rows = await findRelatedSiblingAccounts(db, {
      accountKey: 355100,
      chartRootId: 300000,
      alias: '51',
    });
    assert.deepEqual(rows, [
      {
        accountKey: 1001,
        alias: '51-1',
        name: 'Р/с доп.',
        accountType: 'A',
      },
      {
        accountKey: 1002,
        alias: '51-2',
        name: 'Р/с 2',
        accountType: 'A',
      },
    ]);
  });
});
