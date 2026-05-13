// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import type { TConfig } from '@/api/config';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';

vi.mock('@/utils/request', () => ({
  apiGet: vi.fn().mockResolvedValue(''),
}));
vi.mock('@/i18n/i18n');
vi.mock('@/utils/env', () => ({
  runningInIOS: vi.fn(() => false),
}));
vi.mock('@/contexts/ConfigProvider', () => ({
  useConfig: vi.fn(() => ({
    config: {
      backend: {} as TConfig['backend'],
      frontend: { expertFee: false },
    },
    setConfig: vi.fn(),
  })),
}));

import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { FeeTargets } from './feetargets';
import { apiGet } from '@/utils/request';
import { runningInIOS } from '@/utils/env';
import { useConfig } from '@/contexts/ConfigProvider';

const mockRunningInIOS = vi.mocked(runningInIOS);
const mockUseConfig = vi.mocked(useConfig);

vi.mock('@/hooks/mediaquery', () => ({
  useMediaQuery: vi.fn().mockReturnValue(true),
  useContext: vi.fn(),
}));

describe('routes/account/send/feetargets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunningInIOS.mockReturnValue(false);
    mockUseConfig.mockReturnValue({
      config: {
        backend: {} as TConfig['backend'],
        frontend: { expertFee: false },
      },
      setConfig: vi.fn(),
    });
  });

  it('should call onFeeTargetChange with default', () => new Promise<void>(async done => {
    const apiGetMock = (apiGet as Mock).mockResolvedValue({
      defaultFeeTarget: 'normal',
      feeTargets: [
        { code: 'low' },
        { code: 'economy' },
      ],
    });

    const onFeeTargetChangeCB = (code: string) => {
      expect(code).toBe('normal');
      done();
    };

    render(
      <FeeTargets
        accountCode="btc"
        coinCode="btc"
        disabled={false}
        customFee=""
        onCustomFee={vi.fn()}
        onFeeTargetChange={onFeeTargetChangeCB} />,
    );
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
  }));

  it('normalizes custom fee values from iOS decimal input', async () => {
    mockRunningInIOS.mockReturnValue(true);
    mockUseConfig.mockReturnValue({
      config: {
        backend: {} as TConfig['backend'],
        frontend: { expertFee: true },
      },
      setConfig: vi.fn(),
    });
    const apiGetMock = (apiGet as Mock).mockResolvedValue({
      defaultFeeTarget: 'custom',
      feeTargets: [],
    });
    const onCustomFee = vi.fn();

    const props = {
      accountCode: 'btc' as const,
      coinCode: 'btc' as const,
      disabled: false,
      onCustomFee,
      onFeeTargetChange: vi.fn(),
    };
    const { container, rerender } = render(
      <FeeTargets
        {...props}
        customFee=""
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    let input: HTMLInputElement | null = null;
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalled();
      input = container.querySelector<HTMLInputElement>('#proposedFee');
      expect(input).toBeTruthy();
    });
    if (!input) {
      throw new Error('Custom fee input not found');
    }
    fireEvent.input(input, { target: { value: '1e2,3.4abc' } });
    rerender(
      <FeeTargets
        {...props}
        customFee="12.34"
      />,
    );

    expect(onCustomFee).toHaveBeenCalledWith('12.34');
    expect(input).toHaveValue('12,34');
  });
});
