import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { groupSchemaColumns } from './schema-groups';
import type { DescribeColumnInfo } from './firebird-tools';

describe('groupSchemaColumns', () => {
  it('groups identifiers, references, business, and sensitive columns', () => {
    const columns: DescribeColumnInfo[] = [
      { fieldName: 'ID', fieldType: 'INTEGER' },
      { fieldName: 'GROUPKEY', fieldType: 'INTEGER', refTable: 'GD_GOODGROUP' },
      { fieldName: 'NAME', fieldType: 'VARCHAR' },
      { fieldName: 'PASSWORD', fieldType: 'VARCHAR', sensitive: true },
    ];

    const grouped = groupSchemaColumns(columns);
    assert.equal(grouped.identifiers.length, 1);
    assert.equal(grouped.identifiers[0]?.fieldName, 'ID');
    assert.equal(grouped.references.length, 1);
    assert.equal(grouped.references[0]?.fieldName, 'GROUPKEY');
    assert.equal(grouped.business.length, 1);
    assert.equal(grouped.business[0]?.fieldName, 'NAME');
    assert.equal(grouped.sensitive.length, 1);
    assert.equal(grouped.sensitive[0]?.fieldName, 'PASSWORD');
  });
});
