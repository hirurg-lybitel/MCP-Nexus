'use client';

import { Check, Globe } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LOCALE_LABELS,
  LOCALE_NAMES,
  LOCALES,
  type Locale,
} from '@/lib/i18n/types';
import { useTranslations } from '@/lib/i18n/use-translations';
import { useLocaleStore } from '@/stores/useLocaleStore';

interface LanguageSwitcherProps {
  variant?: 'segmented' | 'dropdown';
}

export default function LanguageSwitcher({
  variant = 'segmented',
}: LanguageSwitcherProps) {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const { t } = useTranslations();

  if (variant === 'dropdown') {
    return (
      <LanguageDropdown
        locale={locale}
        setLocale={setLocale}
        ariaLabel={t('language.label')}
      />
    );
  }

  return (
    <div
      className="flex rounded-lg border border-gray-700 bg-gray-800/80 p-0.5"
      role="group"
      aria-label={t('language.label')}
    >
      {LOCALES.map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
              active
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/80'
            }`}
            aria-pressed={active}
          >
            {LOCALE_LABELS[code]}
          </button>
        );
      })}
    </div>
  );
}

function LanguageDropdown({
  locale,
  setLocale,
  ariaLabel,
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        close();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, close]);

  const handleSelect = (code: Locale) => {
    setLocale(code);
    close();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800/80 px-2.5 py-1.5 text-gray-300 transition-colors hover:bg-gray-700/80 hover:text-white"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Globe className="h-4 w-4 shrink-0" aria-hidden />
        <span className="text-xs font-semibold text-blue-400">
          {LOCALE_LABELS[locale]}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={ariaLabel}
          className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] overflow-hidden rounded-lg border border-gray-700 bg-gray-800 p-1 shadow-xl"
        >
          {LOCALES.map((code) => {
            const active = locale === code;
            return (
              <button
                key={code}
                type="button"
                role="menuitem"
                aria-current={active ? 'true' : undefined}
                onClick={() => handleSelect(code)}
                className="flex w-full rounded-md items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-700/80"
              >
                <Check
                  className={`h-4 w-4 shrink-0 ${active ? 'text-blue-400' : 'invisible'}`}
                  aria-hidden
                />
                <span className={active ? 'text-white' : 'text-gray-300'}>
                  {LOCALE_NAMES[code]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
