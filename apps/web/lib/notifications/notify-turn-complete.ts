import {
  playCompletionChime,
  showAssistantCompleteNotification,
  truncatePreview,
} from './assistant-complete';

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export function notifyTurnCompleteIfBackground(options: {
  preview: string;
  isError?: boolean;
  enabled: boolean;
  t: TranslateFn;
}): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (!options.enabled || !document.hidden) {
    return;
  }

  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  playCompletionChime();

  const preview = truncatePreview(options.preview);
  const title = options.isError
    ? options.t('notifications.errorTitle')
    : options.t('notifications.completeTitle');
  const body = options.isError
    ? options.t('notifications.errorBody', {
        message: preview || options.t('notifications.genericError'),
      })
    : preview
      ? options.t('notifications.completeBody', { preview })
      : options.t('notifications.completeBodyGeneric');

  showAssistantCompleteNotification({ title, body });
}
