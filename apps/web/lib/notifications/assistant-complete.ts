const NOTIFICATION_TAG = 'mcp-nexus-assistant';
const DEFAULT_PREVIEW_MAX = 120;

export function truncatePreview(text: string, maxLen = DEFAULT_PREVIEW_MAX): string {
  const stripped = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!stripped) {
    return '';
  }

  if (stripped.length <= maxLen) {
    return stripped;
  }

  return `${stripped.slice(0, maxLen - 1).trimEnd()}…`;
}

export function playCompletionChime(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const AudioContextCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    const ctx = new AudioContextCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.15);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.start(now);
    osc.stop(now + 0.4);

    osc.onended = () => {
      void ctx.close();
    };
  } catch {
    // Audio may be blocked or unavailable; notification still shows.
  }
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }

  return Notification.requestPermission();
}

export function showAssistantCompleteNotification(options: {
  title: string;
  body: string;
  tag?: string;
}): void {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  new Notification(options.title, {
    body: options.body,
    tag: options.tag ?? NOTIFICATION_TAG,
  });
}
