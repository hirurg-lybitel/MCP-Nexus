import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  loadAccountNameIndex,
  lookupAccountName,
  lookupAccountNameById,
  lookupAccountOffbalance,
} from './account-names.js';

describe('account name index', () => {
  it('indexes by alias and id', async () => {
    const db = {
      executeSql: {
        run: async () => ({
          rows: [
            {
              ID: 1,
              ALIAS: '90.2-3',
              NAME: 'НДС от основной реализации',
              OFFBALANCE: 0,
            },
            {
              ID: 2,
              ALIAS: '90.04',
              NAME: 'Покупная стоимость',
              OFFBALANCE: 0,
            },
            { ID: 3, ALIAS: '001', NAME: 'Забаланс', OFFBALANCE: 1 },
          ],
        }),
      },
    };
    const index = await loadAccountNameIndex(db, 300000);
    assert.equal(lookupAccountName(index, '90.2-3'), 'НДС от основной реализации');
    assert.equal(lookupAccountName(index, '90.04'), 'Покупная стоимость');
    assert.equal(lookupAccountNameById(index, 1), 'НДС от основной реализации');
    assert.equal(lookupAccountName(index, '(none)'), '');
    assert.equal(lookupAccountOffbalance(index, '001'), 1);
    assert.equal(lookupAccountOffbalance(index, '90.04', 2), 0);
  });
});
