'use client';

import { useEffect } from 'react';
import { useLocaleStore } from '@/stores/useLocaleStore';
import { localeToBcp47 } from '@/lib/i18n/types';

export default function LocaleHtmlLang() {
  const locale = useLocaleStore((s) => s.locale);

  useEffect(() => {
    document.documentElement.lang = localeToBcp47(locale);
  }, [locale]);

  return null;
}
