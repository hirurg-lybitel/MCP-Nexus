export const LOCALES = ['en', 'ru', 'by'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'EN',
  ru: 'RU',
  by: 'BY',
};

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ru: 'Русский',
  by: 'Беларуская',
};

/** BCP-47 tags for Intl formatting APIs. */
export function localeToBcp47(locale: Locale): string {
  switch (locale) {
  case 'ru':
    return 'ru-RU';
  case 'by':
    return 'be-BY';
  default:
    return 'en-US';
  }
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function parseLocale(value: string | undefined): Locale {
  const candidate = value ?? '';
  if (isLocale(candidate)) {
    return candidate;
  }
  return DEFAULT_LOCALE;
}
