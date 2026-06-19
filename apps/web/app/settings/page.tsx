'use client';

import Button from '@/components/basic/Button';
import Card from '@/components/basic/Card';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useDeveloperModeStore } from '@/stores/useDeveloperModeStore';
import { useDomainContextStore } from '@/stores/useDomainContextStore';
import { useMcpKeyStore } from '@/stores/useMcpKeyStore';
import { useTokenStore } from '@/stores/useTokenStore';
import { MAX_DOMAIN_CONTEXT_CHARS } from '@/constants';
import { useTranslations } from '@/lib/i18n/use-translations';
import { localeToBcp47 } from '@/lib/i18n/types';
import { useLocaleStore } from '@/stores/useLocaleStore';

export default function SettingsPage() {
  const { token, setToken, clearToken } = useTokenStore();
  const { developerMode, setDeveloperMode } = useDeveloperModeStore();
  const { domainContext, setDomainContext, clearDomainContext } =
    useDomainContextStore();
  const {
    mcpKey,
    isValidated,
    saveValidatedMcpKey,
    setValidated,
    clearMcpKey,
  } = useMcpKeyStore();
  const locale = useLocaleStore((s) => s.locale);
  const { t } = useTranslations();

  const [mcpKeyInput, setMcpKeyInput] = useState(mcpKey);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [mcpSaving, setMcpSaving] = useState(false);
  const numberLocale = localeToBcp47(locale);

  const handleVerifyMcpKey = useCallback(async () => {
    setMcpError(null);
    setMcpSaving(true);

    try {
      const response = await fetch('/api/settings/validate-mcp-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: mcpKeyInput }),
      });

      const data = (await response.json()) as {
        valid?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || !data.valid) {
        setValidated(false);
        setMcpError(
          response.status === 401
            ? t('settings.mcpInvalid')
            : data.error ?? t('settings.mcpVerifyFailed')
        );
        return;
      }

      saveValidatedMcpKey(mcpKeyInput);
    } catch {
      setValidated(false);
      setMcpError(t('settings.mcpVerifyFailed'));
    } finally {
      setMcpSaving(false);
    }
  }, [mcpKeyInput, saveValidatedMcpKey, setValidated, t]);

  const handleClearMcpKey = useCallback(() => {
    clearMcpKey();
    setMcpKeyInput('');
    setMcpError(null);
  }, [clearMcpKey]);

  return (
    <div className="py-8 text-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-white mb-2">{t('settings.title')}</h1>
        <p className="text-gray-400 mb-8">
          {t('settings.subtitle')}
        </p>

        <div className="space-y-6">
          <Card title={t('settings.openAiTitle')}>
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                {t('settings.openAiDescription')}
              </p>
              <div className="flex flex-col gap-2">
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={t('settings.tokenPlaceholder')}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-gray-600"
                />
                {token && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={clearToken}
                    className="w-fit"
                  >
                    {t('settings.removeToken')}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card title={t('settings.mcpTitle')}>
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                {t('settings.mcpDescription')}
              </p>
              <div className="flex flex-col gap-2">
                <input
                  type="password"
                  value={mcpKeyInput}
                  onChange={(e) => {
                    setMcpKeyInput(e.target.value);
                    setMcpError(null);
                    if (isValidated) {
                      setValidated(false);
                    }
                  }}
                  placeholder={t('settings.mcpPlaceholder')}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-gray-600"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={handleVerifyMcpKey}
                    disabled={mcpSaving || !mcpKeyInput.trim()}
                  >
                    {mcpSaving ? t('settings.verifying') : t('settings.verifyAndSave')}
                  </Button>
                  {(mcpKey || isValidated) && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleClearMcpKey}
                    >
                      {t('settings.removeKey')}
                    </Button>
                  )}
                </div>
                {isValidated && (
                  <p className="text-sm text-green-400">
                    {t('settings.mcpVerified')}
                  </p>
                )}
                {mcpError && (
                  <p className="text-sm text-red-400">{mcpError}</p>
                )}
              </div>
            </div>
          </Card>

          <Card title={t('settings.domainTitle')}>
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                {t('settings.domainDescription')}{' '}
                <Link href="/chat" className="text-blue-400 hover:underline">
                  {t('navigation.chat')}
                </Link>
                {t('settings.domainDescriptionEnd')}
              </p>
              <textarea
                value={domainContext}
                onChange={(e) => setDomainContext(e.target.value)}
                placeholder={t('settings.domainPlaceholder')}
                rows={10}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-gray-600 resize-y min-h-[160px]"
              />
              <div className="flex flex-wrap items-center gap-3">
                <p
                  className={`text-sm ${
                    domainContext.length >= MAX_DOMAIN_CONTEXT_CHARS
                      ? 'text-amber-400'
                      : 'text-gray-500'
                  }`}
                >
                  {t('settings.characters', {
                    current: domainContext.length.toLocaleString(numberLocale),
                    max: MAX_DOMAIN_CONTEXT_CHARS.toLocaleString(numberLocale),
                  })}
                </p>
                {domainContext && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={clearDomainContext}
                    className="w-fit"
                  >
                    {t('settings.clear')}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card title={t('settings.developerTitle')}>
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                {t('settings.developerDescription')}
              </p>
              <label className="flex items-center gap-3 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={developerMode}
                  onChange={(e) => setDeveloperMode(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-gray-900"
                />
                <span className="text-sm text-gray-200">{t('settings.developerMode')}</span>
              </label>
            </div>
          </Card>

          <Card title={t('settings.navTitle')}>
            <div className="flex flex-wrap gap-3">
              <Link href="/chat">
                <Button>{t('settings.goToChat')}</Button>
              </Link>
              <Link href="/about">
                <Button variant="secondary">{t('settings.about')}</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
