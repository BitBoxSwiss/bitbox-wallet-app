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

  it.skip('shows the new badge on swap when enabled', async () => {
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
        accounts={[]}
        activeTab="buy"
        code="code-123"
      />,
    );

    expect(await screen.findByTestId('swap-new-badge')).toBeInTheDocument();
  });

  it.skip('hides the new badge on swap when disabled', async () => {
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
        accounts={[]}
        activeTab="buy"
        code="code-234"
      />,
    );

    expect(screen.queryByTestId('swap-new-badge')).not.toBeInTheDocument();
  });

  it.skip('emits swap tab selection when swap is clicked', async () => {
    const user = userEvent.setup();
    const onChangeTab = vi.fn();

    render(
      <MarketTab
        accounts={[]}
        activeTab="buy"
        code="code-345"
      />,
    );

    await user.click(screen.getByRole('button', { name: /generic\.swap/ }));

    expect(onChangeTab).toHaveBeenCalledWith('swap');
  });

  it.skip('emits insure tab selection when insure is clicked', async () => {
    const user = userEvent.setup();
    const onChangeTab = vi.fn();

    render(
      <MarketTab
        accounts={[]}
        activeTab="buy"
        code="code-456"
      />,
    );

    await user.click(screen.getByRole('button', { name: /generic\.insure/ }));

    expect(onChangeTab).toHaveBeenCalledWith('insure');
  });

  it.skip('shows the new badge on otc when enabled', async () => {
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
        accounts={[]}
        activeTab="buy"
        code="code-567"
      />,
    );

    expect(await screen.findByTestId('otc-new-badge')).toBeInTheDocument();
  });
});
