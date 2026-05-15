// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MarketTab } from './markettab';
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

    const swapButton = screen.getByText('generic.swap').closest('button');
    expect(swapButton).not.toBeNull();
    await user.click(swapButton as HTMLButtonElement);

    expect(onChangeTab).toHaveBeenCalledWith('swap');
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
});
