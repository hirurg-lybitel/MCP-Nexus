import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isIdentifierColumn,
  isHiddenByDefaultColumn,
  pickDisplayColumns,
  projectRowsToColumns,
} from './column-picker';

describe('isIdentifierColumn', () => {
  it('treats ID and foreign-key-style names as identifiers', () => {
    assert.equal(isIdentifierColumn('ID'), true);
    assert.equal(isIdentifierColumn('GD_GOOD_ID'), true);
    assert.equal(isIdentifierColumn('GROUPKEY'), true);
    assert.equal(isIdentifierColumn('NAME'), false);
    assert.equal(isIdentifierColumn('PRODUCTCOUNT'), false);
  });
});

describe('isHiddenByDefaultColumn', () => {
  it('hides sensitive columns such as PASSW', () => {
    assert.equal(isHiddenByDefaultColumn('PASSW'), true);
    assert.equal(isHiddenByDefaultColumn('PASSWORD'), true);
    assert.equal(isHiddenByDefaultColumn('NAME'), false);
  });
});

describe('pickDisplayColumns', () => {
  it('omits PASSW from default display columns', () => {
    const rows = [{ ID: 1, NAME: 'User', PASSW: '[REDACTED]' }];
    const cols = pickDisplayColumns(rows, 8);
    assert.ok(cols.includes('NAME'));
    assert.ok(!cols.includes('PASSW'));
  });

  it('prefers NAME over ID and GROUPKEY', () => {
    const rows = [
      {
        ID: 1,
        GROUPKEY: 999,
        NAME: 'Alpha',
        USN: 'x',
        DESCRIPTION: 'Long text',
      },
    ];
    const cols = pickDisplayColumns(rows, 4);
    assert.ok(cols.includes('NAME'));
    assert.ok(cols.includes('DESCRIPTION'));
    assert.ok(!cols.includes('ID'));
    assert.ok(!cols.includes('GROUPKEY'));
    assert.ok(!cols.includes('USN'));
  });

  it('omits ID when few columns fit under limit', () => {
    const rows = [
      { ID: 153707475, NAME: 'Материалы', PRODUCTCOUNT: 551 },
    ];
    const cols = pickDisplayColumns(rows, 8);
    assert.ok(cols.includes('NAME'));
    assert.ok(cols.includes('PRODUCTCOUNT'));
    assert.ok(!cols.includes('ID'));
  });

  it('hides PK/FK from RDB$ when keyFields provided', () => {
    const rows = [
      { ID: 1, GROUPKEY: 9, NAME: 'Alpha', GOODSCOUNT: 10 },
    ];
    const cols = pickDisplayColumns(rows, 8, {
      primaryKey: ['ID'],
      foreignKey: ['GROUPKEY'],
    });
    assert.ok(cols.includes('NAME'));
    assert.ok(cols.includes('GOODSCOUNT'));
    assert.ok(!cols.includes('ID'));
    assert.ok(!cols.includes('GROUPKEY'));
  });

  it('projects rows to selected columns', () => {
    const rows = [{ ID: 1, NAME: 'A', SECRET: 'hide' }];
    const cols = pickDisplayColumns(rows, 2);
    const projected = projectRowsToColumns(rows, cols);
    assert.deepEqual(Object.keys(projected[0]!).sort(), cols.sort());
    assert.ok(!cols.includes('ID'));
  });
});
