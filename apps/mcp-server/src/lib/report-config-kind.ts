/**
 * Human-readable kinds for AC_ACCT_CONFIG.classname values.
 */

export const CLASS_TO_REPORT: Record<string, string> = {
  TAccCardConfig: 'TgdvAcctAccCard',
  TAccLedgerConfig: 'TgdvAcctLedger',
  TAccCirculationListConfig: 'TgdvAcctCirculationList',
  TAccReviewConfig: 'TgdvAcctAccReview',
  TCirculationListConfig: 'TgdvAcctCirculationList',
};

const CLASS_TO_KIND: Record<string, string> = {
  TAccCardConfig: 'карта счёта',
  TAccLedgerConfig: 'журнал-ордер',
  TAccCirculationListConfig: 'ОСВ',
  TCirculationListConfig: 'ОСВ',
  TAccReviewConfig: 'анализ счёта',
  TInvCardConfig: 'карточка складского учёта (не поддерживается)',
};

export function reportKindForClass(className: string): string {
  const key = String(className ?? '').trim();
  if (!key) return 'неизвестный тип отчёта';
  return CLASS_TO_KIND[key] ?? `прочий конфиг (${key})`;
}

export function reportClassForConfig(className: string): string | null {
  const key = String(className ?? '').trim();
  return CLASS_TO_REPORT[key] ?? null;
}
