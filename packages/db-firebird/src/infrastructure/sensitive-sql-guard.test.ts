import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ColumnInfo } from '../ports/ISchemaReader';
import type { ITableSchemaRegistry, TableSchema } from '../ports/ITableSchemaRegistry';
import { SensitiveColumnError } from '../domain/errors';
import {
  assertNoWildcardSelectOnSensitiveTables,
  hasWildcardSelect,
} from '../infrastructure/sensitive-sql-guard';

function mockRegistry(schemas: Record<string, Partial<TableSchema>>): ITableSchemaRegistry {
  return {
    async getTableSchema(tableName: string): Promise<TableSchema> {
      const normalized = tableName.trim().toUpperCase();
      const schema = schemas[normalized];
      if (!schema) {
        return {
          tableName: normalized,
          columns: [],
          sensitiveFields: new Set(),
          hasSensitiveColumns: false,
        };
      }
      return {
        tableName: normalized,
        columns: schema.columns ?? [],
        sensitiveFields: schema.sensitiveFields ?? new Set(),
        hasSensitiveColumns: schema.hasSensitiveColumns ?? false,
      };
    },
    invalidate: () => undefined,
  };
}

describe('hasWildcardSelect', () => {
  it('detects SELECT * and SELECT FIRST N *', () => {
    assert.equal(hasWildcardSelect('SELECT * FROM GD_USER'), true);
    assert.equal(hasWildcardSelect('SELECT FIRST 10 * FROM GD_USER'), true);
    assert.equal(hasWildcardSelect('SELECT u.* FROM GD_USER u'), true);
  });

  it('allows explicit column lists', () => {
    assert.equal(hasWildcardSelect('SELECT ID, NAME FROM GD_USER'), false);
  });
});

describe('assertNoWildcardSelectOnSensitiveTables', () => {
  it('throws when SELECT * targets a table with sensitive columns', async () => {
    const registry = mockRegistry({
      GD_USER: {
        hasSensitiveColumns: true,
        sensitiveFields: new Set(['PASSW']),
        columns: [
          {
            fieldName: 'PASSW',
            fieldType: 'VARCHAR',
            fieldLength: 32,
            nullable: true,
            position: 1,
            sensitive: true,
          } satisfies ColumnInfo,
        ],
      },
    });

    await assert.rejects(
      () =>
        assertNoWildcardSelectOnSensitiveTables(
          'SELECT FIRST 10 * FROM GD_USER',
          registry
        ),
      SensitiveColumnError
    );
  });

  it('allows SELECT * on tables without sensitive columns', async () => {
    const registry = mockRegistry({
      GD_GOOD: { hasSensitiveColumns: false, sensitiveFields: new Set() },
    });

    await assert.doesNotReject(() =>
      assertNoWildcardSelectOnSensitiveTables('SELECT * FROM GD_GOOD', registry)
    );
  });
});
