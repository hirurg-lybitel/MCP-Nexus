import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFirebirdSqlDialect } from '../sql-dialect';
import { assertDialectCompatibleSql } from './firebird-sql-dialect-guard';
import { DialectSqlError } from '../domain/errors';

describe('parseFirebirdSqlDialect', () => {
  it('defaults to 3 (Firebird 5 SQL surface) when unset', () => {
    assert.equal(parseFirebirdSqlDialect({}), '3');
  });

  it('accepts 3, 5, and aliases as modern profile', () => {
    assert.equal(parseFirebirdSqlDialect({ FIREBIRD_SQL_DIALECT: '3' }), '3');
    assert.equal(parseFirebirdSqlDialect({ FIREBIRD_SQL_DIALECT: '30' }), '3');
    assert.equal(parseFirebirdSqlDialect({ FIREBIRD_SQL_DIALECT: '3.0' }), '3');
    assert.equal(parseFirebirdSqlDialect({ FIREBIRD_SQL_DIALECT: '5' }), '3');
    assert.equal(parseFirebirdSqlDialect({ FIREBIRD_SQL_DIALECT: '5.0' }), '3');
    assert.equal(parseFirebirdSqlDialect({ FIREBIRD_SQL_DIALECT: '50' }), '3');
  });

  it('defaults to 3 for unknown values', () => {
    assert.equal(parseFirebirdSqlDialect({ FIREBIRD_SQL_DIALECT: 'postgres' }), '3');
    assert.equal(parseFirebirdSqlDialect({ FIREBIRD_SQL_DIALECT: '4' }), '3');
  });

  it('accepts explicit 2.5 legacy override', () => {
    assert.equal(parseFirebirdSqlDialect({ FIREBIRD_SQL_DIALECT: '2.5' }), '2.5');
    assert.equal(parseFirebirdSqlDialect({ FIREBIRD_SQL_DIALECT: '25' }), '2.5');
  });
});

describe('assertDialectCompatibleSql', () => {
  it('allows window functions on default dialect 3', () => {
    assert.doesNotThrow(() =>
      assertDialectCompatibleSql(
        'SELECT ROW_NUMBER() OVER (ORDER BY ID) AS RN, ID FROM GD_GOOD',
        '3'
      )
    );
  });

  it('allows WITH RECURSIVE and OFFSET/FETCH on dialect 3', () => {
    assert.doesNotThrow(() =>
      assertDialectCompatibleSql(
        'WITH RECURSIVE t AS (SELECT 1 AS x FROM RDB$DATABASE) ' +
          'SELECT * FROM t OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY',
        '3'
      )
    );
  });

  it('allows simple SELECT on dialect 2.5 legacy override', () => {
    assert.doesNotThrow(() =>
      assertDialectCompatibleSql(
        'SELECT FIRST 20 ID, NAME FROM GD_GOOD ORDER BY ID',
        '2.5'
      )
    );
  });

  it('allows non-recursive WITH on dialect 2.5 legacy override', () => {
    assert.doesNotThrow(() =>
      assertDialectCompatibleSql(
        'WITH cte AS (SELECT 1 AS x FROM RDB$DATABASE) SELECT * FROM cte',
        '2.5'
      )
    );
  });

  it('rejects OFFSET/FETCH on dialect 2.5 legacy override', () => {
    assert.throws(
      () =>
        assertDialectCompatibleSql(
          'SELECT ID FROM GD_GOOD ORDER BY ID OFFSET 10 ROWS FETCH NEXT 5 ROWS ONLY',
          '2.5'
        ),
      DialectSqlError
    );
  });

  it('rejects ROW_NUMBER OVER on dialect 2.5 legacy override', () => {
    assert.throws(
      () =>
        assertDialectCompatibleSql(
          'SELECT ROW_NUMBER() OVER (ORDER BY ID) AS RN, ID FROM GD_GOOD',
          '2.5'
        ),
      DialectSqlError
    );
  });

  it('rejects RECURSIVE on dialect 2.5 legacy override', () => {
    assert.throws(
      () =>
        assertDialectCompatibleSql(
          'WITH RECURSIVE tree AS (SELECT ID FROM GD_GOOD) SELECT * FROM tree',
          '2.5'
        ),
      DialectSqlError
    );
  });
});
