import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { requestNotificationPermission } from '@/lib/notifications/assistant-complete';

interface NotificationSettingsState {
  completionNotificationsEnabled: boolean;
  setCompletionNotificationsEnabled: (enabled: boolean) => void;
}

export const useNotificationSettingsStore = create<NotificationSettingsState>()(
  persist(
    (set) => ({
      completionNotificationsEnabled: true,
      setCompletionNotificationsEnabled: (enabled) => {
        set({ completionNotificationsEnabled: enabled });
        if (enabled) {
          void requestNotificationPermission();
        }
      },
    }),
    {
      name: 'notification-settings-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
