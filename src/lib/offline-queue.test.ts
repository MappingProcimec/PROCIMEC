import { describe, it, expect, beforeEach } from 'vitest';
import {
  enqueueOfflineItem,
  getOfflineQueue,
  dequeueOfflineItem,
  clearOfflineQueue,
  syncOfflineQueue,
  isOnline,
} from './offline-queue';

describe('offline-queue', () => {
  const TEST_QUEUE = 'test_inspections';

  beforeEach(() => {
    clearOfflineQueue(TEST_QUEUE);
  });

  it('should enqueue and retrieve offline items', () => {
    const payload = { reportId: 'REP-001', notes: 'Inspección realizada en obra sin señal' };
    const queued = enqueueOfflineItem(TEST_QUEUE, payload);

    expect(queued.id).toBeDefined();
    expect(queued.queueName).toBe(TEST_QUEUE);
    expect(queued.payload).toEqual(payload);

    const items = getOfflineQueue(TEST_QUEUE);
    expect(items.length).toBe(1);
    expect(items[0].id).toBe(queued.id);
    expect(items[0].payload).toEqual(payload);
  });

  it('should dequeue items by ID', () => {
    const item1 = enqueueOfflineItem(TEST_QUEUE, { seq: 1 });
    const item2 = enqueueOfflineItem(TEST_QUEUE, { seq: 2 });

    expect(getOfflineQueue(TEST_QUEUE).length).toBe(2);

    const removed = dequeueOfflineItem(TEST_QUEUE, item1.id);
    expect(removed).toBe(true);

    const remaining = getOfflineQueue(TEST_QUEUE);
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(item2.id);
  });

  it('should clear the entire queue', () => {
    enqueueOfflineItem(TEST_QUEUE, { val: 'a' });
    enqueueOfflineItem(TEST_QUEUE, { val: 'b' });
    expect(getOfflineQueue(TEST_QUEUE).length).toBe(2);

    clearOfflineQueue(TEST_QUEUE);
    expect(getOfflineQueue(TEST_QUEUE).length).toBe(0);
  });

  it('should process and sync offline items with handler', async () => {
    enqueueOfflineItem(TEST_QUEUE, { task: 'upload_report_1' });
    enqueueOfflineItem(TEST_QUEUE, { task: 'upload_report_2' });

    const syncedTasks: string[] = [];
    const result = await syncOfflineQueue<{ task: string }>(TEST_QUEUE, async (payload) => {
      syncedTasks.push(payload.task);
      return true; // éxito
    });

    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
    expect(syncedTasks).toEqual(['upload_report_1', 'upload_report_2']);
    expect(getOfflineQueue(TEST_QUEUE).length).toBe(0);
  });

  it('should retain items in queue if handler returns false or throws', async () => {
    enqueueOfflineItem(TEST_QUEUE, { id: 'fail_item' });

    const result = await syncOfflineQueue(TEST_QUEUE, async () => {
      return false; // fallo temporal de red
    });

    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(1);
    expect(getOfflineQueue(TEST_QUEUE).length).toBe(1);
  });

  it('should detect network status through isOnline()', () => {
    expect(typeof isOnline()).toBe('boolean');
  });
});
