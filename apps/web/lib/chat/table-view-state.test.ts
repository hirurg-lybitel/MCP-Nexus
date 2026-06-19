import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareRowValues,
  filterTableRows,
  mergeVisibleColumns,
  nextSortState,
  paginateRows,
  sortTableRows,
} from './table-view-state';

describe('filterTableRows', () => {
  const columns = [{ key: 'NAME', label: 'Name' }];
  const rows = [
    { NAME: 'Alpha' },
    { NAME: 'Beta' },
  ];

  it('returns all rows when filter is empty', () => {
    assert.equal(filterTableRows(rows, columns, '').length, 2);
  });

  it('filters by visible column text', () => {
    assert.equal(filterTableRows(rows, columns, 'alp').length, 1);
  });
});

describe('sortTableRows', () => {
  const rows = [
    { QTY: 10, NAME: 'B' },
    { QTY: 2, NAME: 'A' },
  ];

  it('sorts numerically ascending', () => {
    const sorted = sortTableRows(rows, { columnKey: 'QTY', direction: 'asc' });
    assert.equal(sorted[0]?.QTY, 2);
  });

  it('sorts descending', () => {
    const sorted = sortTableRows(rows, {
      columnKey: 'NAME',
      direction: 'desc',
    });
    assert.equal(sorted[0]?.NAME, 'B');
  });
});

describe('compareRowValues', () => {
  it('places nulls last in ascending order', () => {
    assert.ok(compareRowValues('a', null, 'asc') < 0);
  });
});

describe('paginateRows', () => {
  it('splits rows into pages', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ ID: i }));
    const page1 = paginateRows(rows, 1, 25);
    assert.equal(page1.pageRows.length, 25);
    assert.equal(page1.totalPages, 2);

    const page2 = paginateRows(rows, 2, 25);
    assert.equal(page2.pageRows.length, 5);
  });
});

describe('nextSortState', () => {
  it('cycles asc → desc → none', () => {
    assert.deepEqual(nextSortState(null, 'NAME'), {
      columnKey: 'NAME',
      direction: 'asc',
    });
    assert.deepEqual(
      nextSortState({ columnKey: 'NAME', direction: 'asc' }, 'NAME'),
      { columnKey: 'NAME', direction: 'desc' }
    );
    assert.equal(
      nextSortState({ columnKey: 'NAME', direction: 'desc' }, 'NAME'),
      null
    );
  });
});

describe('mergeVisibleColumns', () => {
  it('appends hidden columns when toggled on', () => {
    const merged = mergeVisibleColumns(
      [{ key: 'NAME', label: 'Name' }],
      [{ key: 'ID', label: 'Id' }],
      true
    );
    assert.deepEqual(merged.map((c) => c.key), ['NAME', 'ID']);
  });
});
