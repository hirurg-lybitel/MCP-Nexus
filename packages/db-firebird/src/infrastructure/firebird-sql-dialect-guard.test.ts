import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFirebirdSqlDialect } from '../sql-dialect';
import { assertDialectCompatibleSql } from './firebird-sql-dialect-guard';
import { DialectSqlError } from '../domain/errors';

describe('parseFirebirdSqlDialect', () => {
  it('defaults to 2.5 when unset', () => {
    assert.equal(parseFirebirdSqlDialect({}), '2.5');
  });

  it('accepts 3, 30, and 3.0', () => {
    assert.equal(parseFirebirdSqlDialect({ FIREBIRD_SQL_DIALECT: '3' }), '3');
    assert.equal(parseFirebirdSqlDialect({ FIREBIRD_SQL_DIALECT: '30' }), '3');
    assert.equal(parseFirebirdSqlDialect({ FIREBIRD_SQL_DIALECT: '3.0' }), '3');
  });

  it('defaults to 2.5 for invalid values', () => {
    assert.equal(parseFirebirdSqlDialect({ FIREBIRD_SQL_DIALECT: '4' }), '2.5');
    assert.equal(parseFirebirdSqlDialect({ FIREBIRD_SQL_DIALECT: 'postgres' }), '2.5');
  });

  it('accepts 2.5 and 25', () => {
    assert.equal(parseFirebirdSqlDialect({ FIREBIRD_SQL_DIALECT: '2.5' }), '2.5');
    assert.equal(parseFirebirdSqlDialect({ FIREBIRD_SQL_DIALECT: '25' }), '2.5');
  });
});

describe('assertDialectCompatibleSql', () => {
  it('allows simple SELECT on dialect 2.5', () => {
    assert.doesNotThrow(() =>
      assertDialectCompatibleSql(
        'SELECT FIRST 20 ID, NAME FROM GD_GOOD ORDER BY ID',
        '2.5'
      )
    );
  });

  it('rejects WITH on dialect 2.5', () => {
    assert.throws(
      () =>
        assertDialectCompatibleSql(
          'WITH cte AS (SELECT 1 AS x FROM RDB$DATABASE) SELECT * FROM cte',
          '2.5'
        ),
      DialectSqlError
    );
  });

  it('rejects ROW_NUMBER OVER on dialect 2.5', () => {
    assert.throws(
      () =>
        assertDialectCompatibleSql(
          'SELECT ROW_NUMBER() OVER (ORDER BY ID) AS RN, ID FROM GD_GOOD',
          '2.5'
        ),
      DialectSqlError
    );
  });

  it('rejects RECURSIVE on dialect 2.5', () => {
    assert.throws(
      () =>
        assertDialectCompatibleSql(
          'WITH RECURSIVE tree AS (SELECT ID FROM GD_GOOD) SELECT * FROM tree',
          '2.5'
        ),
      DialectSqlError
    );
  });

  it('allows WITH and window functions on dialect 3', () => {
    assert.doesNotThrow(() =>
      assertDialectCompatibleSql(
        'WITH cte AS (SELECT ROW_NUMBER() OVER (ORDER BY ID) AS RN FROM GD_GOOD) SELECT * FROM cte',
        '3'
      )
    );
  });
});
