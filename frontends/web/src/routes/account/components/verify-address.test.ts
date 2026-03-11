// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/i18n');
vi.mock('@/api/keystores');
vi.mock('@/api/account');

import { handleVerifyAddressWithDeviceResult, verifyAddressWithDevice } from './verify-address';
import { connectKeystore } from '@/api/keystores';
import { hasSecureOutput, verifyAddress } from '@/api/account';

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

describe('verifyAddressWithDevice', () => {
  const defaultParams = {
    code: 'acct-code' as Parameters<typeof verifyAddressWithDevice>[0]['code'],
    addressID: 'addr-1',
    rootFingerprint: 'aabbccdd',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns connectFailed when connectKeystore throws', async () => {
    vi.mocked(connectKeystore).mockRejectedValue(new Error('connection error'));

    const result = await verifyAddressWithDevice(defaultParams);

    expect(result).toBe('connectFailed');
    expect(connectKeystore).toHaveBeenCalledWith('aabbccdd');
  });

  it('returns userAbort when connectKeystore returns userAbort error', async () => {
    vi.mocked(connectKeystore).mockResolvedValue({ success: false, errorCode: 'userAbort' });

    const result = await verifyAddressWithDevice(defaultParams);

    expect(result).toBe('userAbort');
  });

  it('returns connectFailed when connectKeystore fails without userAbort', async () => {
    vi.mocked(connectKeystore).mockResolvedValue({ success: false });

    const result = await verifyAddressWithDevice(defaultParams);

    expect(result).toBe('connectFailed');
  });

  it('returns skipDeviceVerification when no secure output', async () => {
    vi.mocked(connectKeystore).mockResolvedValue({ success: true });
    vi.mocked(hasSecureOutput).mockReturnValue(
      () => Promise.resolve({ hasSecureOutput: false, optional: false }),
    );

    const result = await verifyAddressWithDevice(defaultParams);

    expect(result).toBe('skipDeviceVerification');
    expect(hasSecureOutput).toHaveBeenCalledWith('acct-code');
  });

  it('returns verified on success', async () => {
    vi.mocked(connectKeystore).mockResolvedValue({ success: true });
    vi.mocked(hasSecureOutput).mockReturnValue(
      () => Promise.resolve({ hasSecureOutput: true, optional: false }),
    );
    vi.mocked(verifyAddress).mockResolvedValue(true);

    const result = await verifyAddressWithDevice(defaultParams);

    expect(result).toBe('verified');
    expect(verifyAddress).toHaveBeenCalledWith('acct-code', 'addr-1');
  });

  it('calls onSecureVerificationStart before verify', async () => {
    vi.mocked(connectKeystore).mockResolvedValue({ success: true });
    vi.mocked(hasSecureOutput).mockReturnValue(
      () => Promise.resolve({ hasSecureOutput: true, optional: false }),
    );
    vi.mocked(verifyAddress).mockResolvedValue(true);

    const onSecureVerificationStart = vi.fn();
    await verifyAddressWithDevice({ ...defaultParams, onSecureVerificationStart });

    expect(onSecureVerificationStart).toHaveBeenCalledTimes(1);
  });

  it('returns connectFailed when hasSecureOutput throws', async () => {
    vi.mocked(connectKeystore).mockResolvedValue({ success: true });
    vi.mocked(hasSecureOutput).mockReturnValue(
      () => Promise.reject(new Error('api error')),
    );

    const result = await verifyAddressWithDevice(defaultParams);

    expect(result).toBe('connectFailed');
    expect(verifyAddress).not.toHaveBeenCalled();
  });

  it('returns verifyFailed when verifyAddress throws', async () => {
    vi.mocked(connectKeystore).mockResolvedValue({ success: true });
    vi.mocked(hasSecureOutput).mockReturnValue(
      () => Promise.resolve({ hasSecureOutput: true, optional: false }),
    );
    vi.mocked(verifyAddress).mockRejectedValue(new Error('verify error'));

    const result = await verifyAddressWithDevice(defaultParams);

    expect(result).toBe('verifyFailed');
  });
});
