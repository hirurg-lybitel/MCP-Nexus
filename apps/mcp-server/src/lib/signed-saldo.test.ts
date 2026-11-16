import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { splitSignedSaldo, sumTurnover } from './signed-saldo.js';

describe('splitSignedSaldo', () => {
  it('maps positive signed saldo to debit', () => {
    assert.deepEqual(splitSignedSaldo(655753.93), {
      signed: '655753.93',
      debit: '655753.93',
      credit: '0',
    });
  });

  it('maps negative signed saldo to credit (absolute)', () => {
    assert.deepEqual(splitSignedSaldo(-1933.1951), {
      signed: '-1933.1951',
      debit: '0',
      credit: '1933.1951',
    });
  });

  it('maps zero to both sides zero', () => {
    assert.deepEqual(splitSignedSaldo(0), {
      signed: '0',
      debit: '0',
      credit: '0',
    });
  });
});

describe('sumTurnover', () => {
  it('sums row debit/credit without float drift', () => {
    assert.deepEqual(
      sumTurnover([
        { ncuDebit: '0.1', ncuCredit: '0.2' },
        { ncuDebit: '0.2', ncuCredit: '0.1' },
      ]),
      {
        turnoverDebitNcu: '0.3',
        turnoverCreditNcu: '0.3',
      }
    );
  });
});
