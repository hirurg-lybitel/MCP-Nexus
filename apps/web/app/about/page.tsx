'use client';

import Card from '@/components/basic/Card';
import Button from '@/components/basic/Button';
import Link from 'next/link';
import { useTranslations } from '@/lib/i18n/use-translations';

export default function AboutPage() {
  const { t } = useTranslations();

  return (
    <div className="py-8 text-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-white mb-8">
          {t('about.title')}
        </h1>
        
        <div className="space-y-6">
          <Card title={t('about.projectTitle')}>
            <p className="mb-4 text-gray-300">
              {t('about.projectLead')}{' '}
              <strong>{t('about.projectMcp')}</strong>{' '}
              {t('about.projectTail')}
            </p>
            <ul className="list-disc list-inside space-y-1.5 mb-4 text-gray-300">
              <li>{t('about.sourceExternal')}</li>
              <li>{t('about.sourceClient')}</li>
              <li>{t('about.sourceServer')}</li>
            </ul>
            <p className="mb-4 text-gray-300">
              {t('about.projectFooter')}
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://github.com/hirurg-lybitel/MCP-Nexus"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button>
                  {t('about.viewGithub')}
                </Button>
              </a>
              <a
                href="https://github.com/hirurg-lybitel/MCP-Nexus#readme"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary">
                  {t('about.readReadme')}
                </Button>
              </a>
            </div>
          </Card>

          <Card title={t('about.stackTitle')}>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>{t('about.stackNext')}</li>
              <li>{t('about.stackTs')}</li>
              <li>{t('about.stackTurbo')}</li>
              <li>{t('about.stackPnpm')}</li>
              <li>{t('about.stackTailwind')}</li>
            </ul>
          </Card>

          <Card title={t('about.getStartedTitle')}>
            <p className="mb-4 text-gray-300">
              {t('about.getStartedDescription')}
            </p>
            <div className="flex gap-3">
              <Link href="/settings">
                <Button>
                  {t('about.settings')}
                </Button>
              </Link>
              <Link href="/chat">
                <Button variant="secondary">
                  {t('about.goToChat')}
                </Button>
              </Link>
              <Link href="/">
                <Button variant="secondary">
                  {t('about.home')}
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
