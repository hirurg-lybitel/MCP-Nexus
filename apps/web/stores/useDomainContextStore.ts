import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MAX_DOMAIN_CONTEXT_CHARS } from '@/constants';

interface DomainContextState {
  domainContext: string;
  setDomainContext: (value: string) => void;
  clearDomainContext: () => void;
}

export const useDomainContextStore = create<DomainContextState>()(
  persist(
    (set) => ({
      domainContext: '',
      setDomainContext: (value) =>
        set({
          domainContext: value.slice(0, MAX_DOMAIN_CONTEXT_CHARS),
        }),
      clearDomainContext: () => set({ domainContext: '' }),
    }),
    {
      name: 'domain-context-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
