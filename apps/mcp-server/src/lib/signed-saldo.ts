import { addMoney, formatMoney } from './money.js';

/**
 * Split a signed NCU saldo into debit/credit sides.
 * Gedemin AccReview convention: positive = debit, negative = credit (collapsed, no analytics).
 */
export function splitSignedSaldo(value: unknown): {
  signed: string;
  debit: string;
  credit: string;
} {
  const signed = formatMoney(value);
  if (signed === '0') {
    return { signed: '0', debit: '0', credit: '0' };
  }
  if (signed.startsWith('-')) {
    const credit = signed.slice(1) || '0';
    return { signed, debit: '0', credit };
  }
  return { signed, debit: signed, credit: '0' };
}

export function sumTurnover(
  rows: Array<{ ncuDebit?: string; ncuCredit?: string }>
): { turnoverDebitNcu: string; turnoverCreditNcu: string } {
  let debit = '0';
  let credit = '0';
  for (const row of rows) {
    debit = addMoney(debit, row.ncuDebit ?? '0');
    credit = addMoney(credit, row.ncuCredit ?? '0');
  }
  return { turnoverDebitNcu: debit, turnoverCreditNcu: credit };
}
