import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AMPERSANT_2022_D9, moneyEqual } from './d9.js';
import { INTERNAL_ENTRY_PREDICATE } from './cte.js';

describe('D9 internal movements', () => {
  it('documents Ampersant 2022 fixture with differing DONTINMOVE totals', () => {
    assert.ok(
      !moneyEqual(
        AMPERSANT_2022_D9.debitExcludeInternal,
        AMPERSANT_2022_D9.debitIncludeInternal
      )
    );
    const delta =
      Number(AMPERSANT_2022_D9.debitIncludeInternal) -
      Number(AMPERSANT_2022_D9.debitExcludeInternal);
    assert.ok(delta > 300000 && delta < 320000);
  });

  it('predicate matches both ISINTERNAL and same-account equal-sum pairs', () => {
    assert.match(INTERNAL_ENTRY_PREDICATE, /isinternal/);
    assert.match(INTERNAL_ENTRY_PREDICATE, /accountkey=e_m\.accountkey|accountkey = e_m\.accountkey/);
    assert.match(INTERNAL_ENTRY_PREDICATE, /debitncu/);
  });
});
