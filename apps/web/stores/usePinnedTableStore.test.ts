import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { usePinnedTableStore } from './usePinnedTableStore';
import type { TableDisplayData } from '@/types';

const sampleData: TableDisplayData = {
  title: 'Documents',
  columns: [{ key: 'ID', label: 'ID' }],
  rows: [{ ID: 1 }, { ID: 2 }],
  meta: { rowCount: 2 },
};

describe('usePinnedTableStore', () => {
  beforeEach(() => {
    usePinnedTableStore.setState({ messageId: null, data: null });
  });

  it('pin sets messageId and clones data', () => {
    usePinnedTableStore.getState().pin('msg-1', sampleData);
    const state = usePinnedTableStore.getState();
    assert.equal(state.messageId, 'msg-1');
    assert.deepEqual(state.data?.rows, sampleData.rows);
    assert.notEqual(state.data, sampleData);
  });

  it('pin replaces previous pin', () => {
    usePinnedTableStore.getState().pin('msg-1', sampleData);
    usePinnedTableStore.getState().pin('msg-2', {
      ...sampleData,
      title: 'Other',
    });
    const state = usePinnedTableStore.getState();
    assert.equal(state.messageId, 'msg-2');
    assert.equal(state.data?.title, 'Other');
  });

  it('unpin clears state', () => {
    usePinnedTableStore.getState().pin('msg-1', sampleData);
    usePinnedTableStore.getState().unpin();
    const state = usePinnedTableStore.getState();
    assert.equal(state.messageId, null);
    assert.equal(state.data, null);
  });

  it('isPinned returns true only for pinned messageId', () => {
    usePinnedTableStore.getState().pin('msg-1', sampleData);
    assert.equal(usePinnedTableStore.getState().isPinned('msg-1'), true);
    assert.equal(usePinnedTableStore.getState().isPinned('msg-2'), false);
  });
});
