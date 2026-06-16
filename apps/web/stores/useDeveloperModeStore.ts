import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface DeveloperModeState {
  developerMode: boolean;
  setDeveloperMode: (enabled: boolean) => void;
}

export const useDeveloperModeStore = create<DeveloperModeState>()(
  persist(
    (set) => ({
      developerMode: false,
      setDeveloperMode: (developerMode) => set({ developerMode }),
    }),
    {
      name: 'developer-mode-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
