// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { apiSubscribe } from './event';

const mocks = vi.hoisted(() => ({
  apiWebsocket: vi.fn(),
}));

vi.mock('./websocket', () => ({
  apiWebsocket: mocks.apiWebsocket,
}));

describe('apiSubscribe', () => {
  it('registers the observer before starting the event transport', () => {
    const observer = vi.fn();
    mocks.apiWebsocket.mockImplementation((callback) => {
      callback({ subject: 'online', action: 'replace', object: true });
      return () => {};
    });

    apiSubscribe('online', observer);

    expect(observer).toHaveBeenCalledWith({
      subject: 'online',
      action: 'replace',
      object: true,
    });
  });
});
