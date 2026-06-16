import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface McpKeyState {
  mcpKey: string;
  isValidated: boolean;
  setMcpKey: (mcpKey: string) => void;
  saveValidatedMcpKey: (mcpKey: string) => void;
  setValidated: (isValidated: boolean) => void;
  clearMcpKey: () => void;
}

export const useMcpKeyStore = create<McpKeyState>()(
  persist(
    (set) => ({
      mcpKey: '',
      isValidated: false,
      setMcpKey: (mcpKey) => set({ mcpKey, isValidated: false }),
      saveValidatedMcpKey: (mcpKey) => set({ mcpKey, isValidated: true }),
      setValidated: (isValidated) => set({ isValidated }),
      clearMcpKey: () => set({ mcpKey: '', isValidated: false }),
    }),
    {
      name: 'mcp-key-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
