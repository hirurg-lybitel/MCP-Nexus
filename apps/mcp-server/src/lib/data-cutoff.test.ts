import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DATA_CUTOFF_SQL, queryDataCutoff } from './data-cutoff.js';

describe('queryDataCutoff (BUG-06)', () => {
  it('filters out future dates via CURRENT_DATE / <= 2100 in SQL', () => {
    assert.match(DATA_CUTOFF_SQL, /entrydate\s*<=\s*CURRENT_DATE/i);
    assert.match(DATA_CUTOFF_SQL, /<=\s*2100/);
  });

  it('formats YYYY-MM-DD with zero-padded month and day', async () => {
    const cutoff = await queryDataCutoff({
      executeSql: {
        run: async () => ({ rows: [{ Y: 2026, M: 10, D: 5 }] }),
      },
    });
    assert.equal(cutoff, '2026-10-05');
  });

  it('returns null when table is empty', async () => {
    const cutoff = await queryDataCutoff({
      executeSql: {
        run: async () => ({ rows: [{ Y: null, M: null, D: null }] }),
      },
    });
    assert.equal(cutoff, null);
  });
});
