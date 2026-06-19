'use client';

import { useEffect, useState } from 'react';
import { requestNotificationPermission } from '@/lib/notifications/assistant-complete';
import { useNotificationSettingsStore } from '@/stores/useNotificationSettingsStore';

const SESSION_KEY = 'mcp-nexus-notification-prompt-attempted';

function tryRequestNotificationPermission(enabled: boolean): void {
  if (!enabled) {
    return;
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'default') {
    return;
  }

  if (sessionStorage.getItem(SESSION_KEY)) {
    return;
  }

  sessionStorage.setItem(SESSION_KEY, '1');
  void requestNotificationPermission();
}

export function useNotificationPermissionOnOpen(enabled: boolean): void {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persist = useNotificationSettingsStore.persist;
    if (!persist) {
      setHydrated(true);
      return;
    }

    setHydrated(persist.hasHydrated());

    const unsub = persist.onFinishHydration(() => {
      setHydrated(true);
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    tryRequestNotificationPermission(enabled);
  }, [enabled, hydrated]);
}
