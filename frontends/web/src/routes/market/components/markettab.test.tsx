// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import type { TConfig } from '@/api/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MarketTab } from './markettab';
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

    const swapButton = screen.getByText('generic.swap').closest('button');
    expect(swapButton).not.toBeNull();
    await user.click(swapButton as HTMLButtonElement);

    expect(onChangeTab).toHaveBeenCalledWith('swap');
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
});
