// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TEvent } from '@/utils/event';
import { subscribeEndpoint, subscribeEvent } from './subscribe';

const mocks = vi.hoisted(() => ({
  apiPost: vi.fn(),
  apiSubscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('@/utils/request', () => ({ apiPost: mocks.apiPost }));
vi.mock('@/utils/event', () => ({ apiSubscribe: mocks.apiSubscribe }));

describe('subscribeEndpoint', () => {
  let receiveEvent: ((event: TEvent) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    receiveEvent = undefined;
    mocks.apiPost.mockResolvedValue({ success: true });
    mocks.apiSubscribe.mockImplementation((_subject, observer) => {
      receiveEvent = observer;
      return mocks.unsubscribe;
    });
  });

  it('requests an initial snapshot and forwards replacement events', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeEndpoint('online', callback);

    expect(mocks.apiSubscribe).toHaveBeenCalledWith('online', expect.any(Function));
    expect(mocks.apiPost).toHaveBeenCalledWith('events/snapshot', 'online');

    receiveEvent?.({ subject: 'online', action: 'replace', object: true });

    expect(callback).toHaveBeenCalledWith(true);
    expect(unsubscribe).toBe(mocks.unsubscribe);
  });

  it('does not request snapshots for transient events', () => {
    subscribeEvent('new-txs', vi.fn());

    expect(mocks.apiSubscribe).toHaveBeenCalledWith('new-txs', expect.any(Function));
    expect(mocks.apiPost).not.toHaveBeenCalled();
  });
});
