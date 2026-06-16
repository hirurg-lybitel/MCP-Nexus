import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeQueryResult } from './query-result-summary';

describe('summarizeQueryResult', () => {
  it('returns column names, counts, and sample rows without full row set', () => {
    const summary = summarizeQueryResult(
      [
        { ID: 1, NAME: 'Alpha' },
        { ID: 2, NAME: 'Beta' },
      ],
      2,
      false
    );

    assert.deepEqual(summary, {
      ok: true,
      rowCount: 2,
      columns: ['ID', 'NAME'],
      truncated: false,
      sampleRows: [
        { ID: 1, NAME: 'Alpha' },
        { ID: 2, NAME: 'Beta' },
      ],
    });
  });

  it('caps sampleRows at MAX_SAMPLE_ROWS', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ ID: i }));
    const summary = summarizeQueryResult(rows, 10, false);

    assert.equal(summary.sampleRows?.length, 5);
    assert.equal(summary.rowCount, 10);
  });

  it('returns empty columns when there are no rows', () => {
    const summary = summarizeQueryResult([], 0, false);
    assert.deepEqual(summary.columns, []);
    assert.equal(summary.rowCount, 0);
    assert.equal(summary.sampleRows, undefined);
  });
});
