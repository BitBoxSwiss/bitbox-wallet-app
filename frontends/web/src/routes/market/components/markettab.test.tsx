// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarketTab } from './markettab';
import { getMarketSelectPath } from './marketplace-navigation';
import { getConfig } from '@/utils/config';

vi.mock('@/utils/config', () => ({
  getConfig: vi.fn(),
  setConfig: vi.fn(),
}));

const mockedGetConfig = vi.mocked(getConfig);

describe('routes/market/components/markettab', () => {
  beforeEach(() => {
    mockedGetConfig.mockResolvedValue({ frontend: {} });
  });

  it('shows the new badge on swap when enabled', async () => {
    mockedGetConfig.mockResolvedValue({
      frontend: {
        hasSeenOtcMarketTab: true,
        hasSeenSwapMarketTab: false,
      }
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
    mockedGetConfig.mockResolvedValue({
      frontend: {
        hasSeenOtcMarketTab: true,
        hasSeenSwapMarketTab: true,
      }
    });

    render(
      <MarketTab
        activeTab="buy"
        onChangeTab={vi.fn()}
        showSwap
      />,
    );

    await waitFor(() => {
      expect(mockedGetConfig).toHaveBeenCalled();
    });
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
    mockedGetConfig.mockResolvedValue({
      frontend: {
        hasSeenOtcMarketTab: false,
        hasSeenSwapMarketTab: true,
      }
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
