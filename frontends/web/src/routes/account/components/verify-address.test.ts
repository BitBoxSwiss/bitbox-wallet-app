// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/i18n');

import { handleVerifyAddressWithDeviceResult } from './verify-address';

describe('routes/account/components/verify-address', () => {
  it.each([
    ['userAbort', 'onUserAbort'],
    ['connectFailed', 'onConnectFailed'],
    ['skipDeviceVerification', 'onSkipDeviceVerification'],
    ['verified', 'onVerified'],
    ['verifyFailed', 'onVerifyFailed'],
  ] as const)('dispatches %s to %s handler', (result, expectedHandler) => {
    const handlers = {
      onUserAbort: vi.fn(),
      onConnectFailed: vi.fn(),
      onSkipDeviceVerification: vi.fn(),
      onVerified: vi.fn(),
      onVerifyFailed: vi.fn(),
    };

    handleVerifyAddressWithDeviceResult(result, handlers);

    expect(handlers[expectedHandler]).toHaveBeenCalledTimes(1);

    Object.entries(handlers)
      .filter(([name]) => name !== expectedHandler)
      .forEach(([, handler]) => {
        expect(handler).not.toHaveBeenCalled();
      });
  });
});
