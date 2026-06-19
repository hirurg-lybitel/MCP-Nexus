'use client';

import { PackageOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslations } from '@/lib/i18n/use-translations';

export default function Navigation() {
  const pathname = usePathname();
  const { t } = useTranslations();

  const navItems = [
    { href: '/chat', label: t('navigation.chat') },
    { href: '/settings', label: t('navigation.settings') },
    { href: '/about', label: t('navigation.about') },
  ];

  return (
    <nav className="bg-gray-900 shadow-md fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="shrink-0 flex items-center">
              <Link href="/" className="flex items-center">
                <PackageOpen className="text-blue-500 mr-2" />
                <span className="text-xl font-bold text-blue-500">
                  {t('navigation.brand')}
                </span>
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive
                        ? 'border-blue-400 text-blue-500'
                        : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="content-center text-end hidden sm:block">
              <h1 className="text-xl font-bold text-white">{t('navigation.title')}</h1>
              <p className="text-sm text-gray-400">
                {t('navigation.subtitle')}
              </p>
            </div>
            <LanguageSwitcher variant="dropdown" />
          </div>
        </div>
      </div>
    </nav>
  );
}
