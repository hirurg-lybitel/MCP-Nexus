import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  reportClassForConfig,
  reportKindForClass,
} from './report-config-kind.js';

describe('report config kind', () => {
  it('maps known classes to Russian reportKind', () => {
    assert.equal(reportKindForClass('TAccCirculationListConfig'), 'ОСВ');
    assert.equal(reportKindForClass('TAccLedgerConfig'), 'журнал-ордер');
    assert.equal(reportKindForClass('TAccCardConfig'), 'карта счёта');
    assert.equal(reportKindForClass('TAccReviewConfig'), 'анализ счёта');
    assert.match(
      reportKindForClass('TInvCardConfig'),
      /складского учёта/
    );
  });

  it('maps supported classes to worker reportClass', () => {
    assert.equal(
      reportClassForConfig('TAccLedgerConfig'),
      'TgdvAcctLedger'
    );
    assert.equal(reportClassForConfig('TInvCardConfig'), null);
  });
});
