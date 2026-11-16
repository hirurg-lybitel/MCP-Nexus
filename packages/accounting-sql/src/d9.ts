/**
 * D9 — internal movements, same rule as AC_CIRCULATIONLIST_BAL DONTINMOVE=1.
 */

export interface DontInMoveFixture {
  label: string;
  companyKey: number;
  chartRootId: number;
  dateBegin: string;
  dateEnd: string;
  /** Expected SUM(ncu_debit) with DONTINMOVE=1 */
  debitExcludeInternal: string;
  /** Expected SUM(ncu_debit) with DONTINMOVE=0 */
  debitIncludeInternal: string;
}

/**
 * Ampersant 2022: 12 ISINTERNAL entry sides; procedure totals differ.
 * Verified 2026-11-03 on CRM_WORKER / CRM_FB5.
 */
export const AMPERSANT_2022_D9: DontInMoveFixture = {
  label: 'Ampersant-2022-full',
  companyKey: 146866007,
  chartRootId: 300001,
  dateBegin: '2022-01-01',
  dateEnd: '2022-12-31',
  debitExcludeInternal: '9722349.7700',
  debitIncludeInternal: '10034410.4800',
};

export function moneyEqual(a: string | number, b: string | number): boolean {
  return Math.abs(Number(a) - Number(b)) < 0.00005;
}
