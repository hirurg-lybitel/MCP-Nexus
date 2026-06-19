import type { Locale } from './types';
import { DEFAULT_LOCALE } from './types';
import en from './messages/en.json';
import ru from './messages/ru.json';
import by from './messages/by.json';

type MessageTree = Record<string, string | Record<string, unknown>>;

const messagesByLocale: Record<Locale, MessageTree> = { en, ru, by };

export function getMessages(locale: Locale): MessageTree {
  return messagesByLocale[locale] ?? messagesByLocale[DEFAULT_LOCALE];
}

function resolvePath(tree: MessageTree, key: string): string | undefined {
  const parts = key.split('.');
  let current: unknown = tree;

  for (const part of parts) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === 'string' ? current : undefined;
}

export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  const tree = getMessages(locale);
  let text =
    resolvePath(tree, key) ??
    resolvePath(messagesByLocale[DEFAULT_LOCALE], key) ??
    key;

  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{{${name}}}`, String(value));
    }
  }

  return text;
}
