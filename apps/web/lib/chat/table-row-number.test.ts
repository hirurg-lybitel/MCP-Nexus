import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasExplicitRowNumberColumn,
  shouldShowUiRowNumberColumn,
  UI_ROW_NUMBER_KEY,
  withUiRowNumberColumn,
} from './table-row-number';

describe('hasExplicitRowNumberColumn', () => {
  it('detects ROW_NUM key', () => {
    assert.equal(
      hasExplicitRowNumberColumn([{ key: 'ROW_NUM', label: 'N' }]),
      true
    );
  });

  it('detects № label', () => {
    assert.equal(
      hasExplicitRowNumberColumn([{ key: 'IDX', label: '№' }]),
      true
    );
  });

  it('returns false for ordinary columns', () => {
    assert.equal(
      hasExplicitRowNumberColumn([{ key: 'NAME', label: 'Name' }]),
      false
    );
  });
});

describe('withUiRowNumberColumn', () => {
  it('prepends synthetic row number column', () => {
    const cols = withUiRowNumberColumn(
      [{ key: 'NAME', label: 'Name' }],
      true,
      '№'
    );
    assert.equal(cols.length, 2);
    assert.equal(cols[0]?.key, UI_ROW_NUMBER_KEY);
    assert.equal(cols[0]?.label, '№');
  });

  it('skips when explicit row number exists', () => {
    const cols = withUiRowNumberColumn(
      [{ key: 'ROW_NUM', label: '№' }],
      true,
      '№'
    );
    assert.equal(cols.length, 1);
  });
});

describe('shouldShowUiRowNumberColumn', () => {
  it('shows for multi-row tables without explicit column', () => {
    assert.equal(
      shouldShowUiRowNumberColumn(5, [{ key: 'NAME', label: 'Name' }]),
      true
    );
  });

  it('hides for single row', () => {
    assert.equal(
      shouldShowUiRowNumberColumn(1, [{ key: 'NAME', label: 'Name' }]),
      false
    );
  });
});
