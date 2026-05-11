// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import type { TConfig } from '@/api/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MarketTab } from './markettab';
import { getMarketSelectPath } from './marketplace-navigation';
import { useConfig } from '@/contexts/ConfigProvider';

vi.mock('@/contexts/ConfigProvider', () => ({
  useConfig: vi.fn(() => ({
    config: { frontend: {}, backend: {} } as TConfig,
    setConfig: vi.fn(),
  })),
}));

const mockUseConfig = vi.mocked(useConfig);

describe('routes/market/components/markettab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue({
      config: { frontend: {}, backend: {} } as TConfig,
      setConfig: vi.fn(),
    });
  });

  it('shows the new badge on swap when enabled', async () => {
    mockUseConfig.mockReturnValue({
      config: {
        frontend: {
          hasSeenOtcMarketTab: true,
          hasSeenSwapMarketTab: false,
        },
      } as TConfig,
      setConfig: vi.fn(),
    });

    render(
      <MarketTab
        activeTab="buy"
        onChangeTab={vi.fn()}
        showSwap
      />,
    );

    expect(await screen.findByTestId('swap-new-badge')).toBeInTheDocument();
  });

  it('hides the new badge on swap when disabled', async () => {
    mockUseConfig.mockReturnValue({
      config: {
        frontend: {
          hasSeenOtcMarketTab: true,
          hasSeenSwapMarketTab: true,
        },
      } as TConfig,
      setConfig: vi.fn(),
    });

    render(
      <MarketTab
        activeTab="buy"
        onChangeTab={vi.fn()}
        showSwap
      />,
    );

    expect(screen.queryByTestId('swap-new-badge')).not.toBeInTheDocument();
  });

  it('emits swap tab selection when swap is clicked', async () => {
    const user = userEvent.setup();
    const onChangeTab = vi.fn();

    render(
      <MarketTab
        activeTab="buy"
        onChangeTab={onChangeTab}
        showSwap
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Swap' }));

    expect(onChangeTab).toHaveBeenCalledWith('swap');
  });

  it('emits insure tab selection when insure is clicked', async () => {
    const user = userEvent.setup();
    const onChangeTab = vi.fn();

    render(
      <MarketTab
        activeTab="buy"
        onChangeTab={onChangeTab}
        showSwap
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Insure' }));

    expect(onChangeTab).toHaveBeenCalledWith('insure');
  });

  it('shows the new badge on otc when enabled', async () => {
    mockUseConfig.mockReturnValue({
      config: {
        frontend: {
          hasSeenOtcMarketTab: false,
          hasSeenSwapMarketTab: true,
        },
      } as TConfig,
      setConfig: vi.fn(),
    });

    render(
      <MarketTab
        activeTab="buy"
        onChangeTab={vi.fn()}
        showSwap
      />,
    );

    expect(await screen.findByTestId('otc-new-badge')).toBeInTheDocument();
  });

  it('preserves the account code in market select tab paths', () => {
    expect(getMarketSelectPath('sell', 'btc-1')).toBe('/market/select/btc-1?tab=sell');
  });

  it('builds market select tab paths without account code', () => {
    expect(getMarketSelectPath('sell')).toBe('/market/select?tab=sell');
  });
});
