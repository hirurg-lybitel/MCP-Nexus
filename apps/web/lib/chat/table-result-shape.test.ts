import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectResultViewMode } from './table-result-shape';
import type { TableDisplayData } from '@/types';

function sampleData(
  overrides: Partial<TableDisplayData> = {}
): TableDisplayData {
  return {
    columns: [{ key: 'A', label: 'A' }],
    rows: [{ A: 1 }],
    ...overrides,
  };
}

describe('detectResultViewMode', () => {
  it('returns scalar for single row with up to 4 columns', () => {
    assert.equal(
      detectResultViewMode(
        sampleData({
          columns: [
            { key: 'NAME', label: 'Name' },
            { key: 'QTY', label: 'Qty' },
          ],
          rows: [{ NAME: 'Widget', QTY: 3 }],
        })
      ),
      'scalar'
    );
  });

  it('returns table for multi-row results', () => {
    assert.equal(
      detectResultViewMode(
        sampleData({
          rows: [{ A: 1 }, { A: 2 }],
        })
      ),
      'table'
    );
  });

  it('returns table for wide single row', () => {
    assert.equal(
      detectResultViewMode(
        sampleData({
          columns: Array.from({ length: 8 }, (_, i) => ({
            key: `C${i}`,
            label: `C${i}`,
          })),
        })
      ),
      'table'
    );
  });

  it('returns table when truncated', () => {
    assert.equal(
      detectResultViewMode(
        sampleData({
          meta: { rowCount: 1, truncated: true },
        })
      ),
      'table'
    );
  });
});
