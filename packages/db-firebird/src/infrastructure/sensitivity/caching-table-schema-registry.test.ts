import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ColumnInfo, ISchemaReader } from '../../ports/ISchemaReader';
import { createDefaultPatternSet } from '../../domain/sensitivity/pattern-set';
import { PatternSensitiveFieldClassifier } from './pattern-sensitive-field-classifier';
import { CachingTableSchemaRegistry } from './caching-table-schema-registry';

function mockSchemaReader(columnsByTable: Record<string, ColumnInfo[]>): ISchemaReader {
  const calls: string[] = [];
  const reader: ISchemaReader = {
    listTables: async () => [],
    describeTable: async (tableName: string) => {
      calls.push(tableName);
      return columnsByTable[tableName] ?? [];
    },
    searchTables: async () => [],
    getTableDisplayName: async () => null,
    resolveFieldDisplayNames: async () => ({}),
    findUnknownTableNames: async () => [],
    getTableFieldConstraints: async () => ({
      tableName: '',
      primaryKey: [],
      foreignKey: [],
      constraints: [],
    }),
  };
  return reader;
}

describe('CachingTableSchemaRegistry', () => {
  it('enriches columns with sensitive flags and caches schema', async () => {
    const reader = mockSchemaReader({
      GD_USER: [
        {
          fieldName: 'NAME',
          displayName: 'Имя',
          fieldType: 'VARCHAR',
          fieldLength: 80,
          nullable: true,
          position: 0,
        },
        {
          fieldName: 'FIELD1',
          displayName: 'Пароль',
          fieldType: 'VARCHAR',
          fieldLength: 32,
          nullable: true,
          position: 1,
        },
      ],
    });

    const classifier = new PatternSensitiveFieldClassifier(
      createDefaultPatternSet()
    );
    const registry = new CachingTableSchemaRegistry(reader, classifier);

    const first = await registry.getTableSchema('GD_USER');
    const second = await registry.getTableSchema('GD_USER');

    assert.strictEqual(first, second);
    assert.equal(first.hasSensitiveColumns, true);
    assert.ok(first.sensitiveFields.has('FIELD1'));
    assert.equal(first.columns[1]?.sensitive, true);
    assert.ok(first.columns[1]?.sensitivitySignals?.includes('displayName'));
  });
});
