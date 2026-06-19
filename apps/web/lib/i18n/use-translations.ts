'use client';

import { useCallback } from 'react';
import { useLocaleStore } from '@/stores/useLocaleStore';
import { translate } from './get-messages';
import type { Locale } from './types';

export function useTranslations() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
    [locale]
  );

  return { t, locale, setLocale } satisfies {
    t: (key: string, vars?: Record<string, string | number>) => string;
    locale: Locale;
    setLocale: (locale: Locale) => void;
  };
}
