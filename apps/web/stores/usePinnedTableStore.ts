import { create } from 'zustand';
import type { TableDisplayData } from '@/types';

interface PinnedTableState {
  messageId: string | null;
  data: TableDisplayData | null;
  pin: (messageId: string, data: TableDisplayData) => void;
  unpin: () => void;
  isPinned: (messageId: string) => boolean;
}

function cloneTableData(data: TableDisplayData): TableDisplayData {
  if (typeof structuredClone === 'function') {
    return structuredClone(data);
  }
  return JSON.parse(JSON.stringify(data)) as TableDisplayData;
}

export const usePinnedTableStore = create<PinnedTableState>((set, get) => ({
  messageId: null,
  data: null,
  pin: (messageId, data) => {
    set({ messageId, data: cloneTableData(data) });
  },
  unpin: () => {
    set({ messageId: null, data: null });
  },
  isPinned: (messageId) => get().messageId === messageId,
}));
