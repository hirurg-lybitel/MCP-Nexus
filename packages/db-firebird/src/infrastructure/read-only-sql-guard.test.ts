import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertReadOnlySql } from './read-only-sql-guard';
import { ReadOnlySqlError } from '../domain/errors';

function rejects(sql: string): void {
  assert.throws(() => assertReadOnlySql(sql), ReadOnlySqlError);
}

describe('assertReadOnlySql', () => {
  it('allows SELECT', () => {
    assert.doesNotThrow(() => assertReadOnlySql('SELECT 1 FROM RDB$DATABASE'));
  });

  it('allows WITH', () => {
    assert.doesNotThrow(() =>
      assertReadOnlySql('WITH cte AS (SELECT 1 AS x FROM RDB$DATABASE) SELECT * FROM cte')
    );
  });

  it('rejects INSERT', () => {
    rejects('INSERT INTO T (ID) VALUES (1)');
  });

  it('rejects UPDATE', () => {
    rejects('UPDATE T SET NAME = 1 WHERE ID = 1');
  });

  it('rejects DELETE', () => {
    rejects('DELETE FROM T WHERE ID = 1');
  });

  it('rejects DDL', () => {
    rejects('CREATE TABLE T (ID INT)');
    rejects('ALTER TABLE T ADD COL INT');
    rejects('DROP TABLE T');
  });

  it('rejects EXECUTE BLOCK', () => {
    rejects('EXECUTE BLOCK AS BEGIN END');
  });

  it('rejects MERGE', () => {
    rejects('MERGE INTO T USING S ON 1=1 WHEN MATCHED THEN UPDATE SET X=1');
  });

  it('rejects semicolon', () => {
    rejects('SELECT 1; SELECT 2');
  });

  it('rejects empty SQL', () => {
    rejects('   ');
  });

  it('rejects mutating GEN_ID (non-zero step)', () => {
    rejects('SELECT GEN_ID(MY_GEN, 1) FROM RDB$DATABASE');
    rejects('SELECT GEN_ID(gd_g_entry_balance_date, :step) FROM RDB$DATABASE');
  });

  it('allows GEN_ID(..., 0) read of generator value', () => {
    assert.doesNotThrow(() =>
      assertReadOnlySql(
        "SELECT CAST(DATE '1858-11-17' + GEN_ID(gd_g_entry_balance_date, 0) AS DATE) AS closedate FROM ac_account"
      )
    );
  });

  it('rejects FOR UPDATE', () => {
    rejects('SELECT ID FROM GD_GOOD WHERE ID = 1 FOR UPDATE');
  });

  it('rejects SELECT INTO', () => {
    rejects('SELECT ID INTO NEW_TABLE FROM GD_GOOD');
  });
});
