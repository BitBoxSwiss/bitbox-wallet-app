// SPDX-License-Identifier: Apache-2.0

import '../../../../../__mocks__/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/i18n');

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwapServiceSelector } from './swap-service-selector';

describe('routes/market/swap/components/swap-service-selector', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renders grouped providers and overflow badge', () => {
    render(
      <SwapServiceSelector
        buyUnit="ETH"
        isLoading={false}
        onChangeRouteId={vi.fn()}
        routes={[{
          expectedBuyAmount: '1.23',
          providers: ['THORCHAIN_STREAMING', 'MAYACHAIN', 'JUPITER', 'OKX'],
          routeId: 'route-1',
        }]}
        selectedRouteId="route-1"
      />,
    );

    expect(screen.getByText('THORChain + Mayachain + Jupiter + OKX')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getAllByAltText('logo.label')).toHaveLength(3);
  });

  it('falls back to raw provider ids and placeholder logos for unknown providers', () => {
    render(
      <SwapServiceSelector
        buyUnit="ETH"
        isLoading={false}
        onChangeRouteId={vi.fn()}
        routes={[{
          expectedBuyAmount: '1.23',
          providers: ['mysterydex'],
          routeId: 'route-1',
        }]}
        selectedRouteId="route-1"
      />,
    );

    expect(screen.getByText('mysterydex')).toBeInTheDocument();
    expect(screen.getByLabelText('logo.placeholderLabel')).toBeInTheDocument();
  });

  it('renders a single route as an openable dropdown', async () => {
    const user = userEvent.setup();

    render(
      <SwapServiceSelector
        buyUnit="ETH"
        isLoading={false}
        onChangeRouteId={vi.fn()}
        routes={[{
          expectedBuyAmount: '1.23',
          providers: ['THORCHAIN'],
          routeId: 'route-1',
        }]}
        selectedRouteId="route-1"
      />,
    );

    expect(screen.getByText('THORChain')).toBeInTheDocument();
    expect(screen.getByText('swap.oneRouteAvailable')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox'));

    expect(await screen.findByRole('option', { name: /THORChain/ })).toBeInTheDocument();
  });

  it('emits route id when selecting another grouped route', async () => {
    const user = userEvent.setup();
    const onChangeRouteId = vi.fn();

    render(
      <SwapServiceSelector
        buyUnit="ETH"
        isLoading={false}
        onChangeRouteId={onChangeRouteId}
        routes={[
          {
            expectedBuyAmount: '1.23',
            providers: ['THORCHAIN', 'MAYACHAIN_STREAMING'],
            routeId: 'route-1',
          },
          {
            expectedBuyAmount: '2.34',
            providers: ['JUPITER', 'UNISWAP_V2'],
            routeId: 'route-2',
          },
        ]}
        selectedRouteId="route-1"
      />,
    );

    await user.click(screen.getByText('THORChain + Mayachain'));
    await user.click(await screen.findByText('Jupiter + Uniswap'));

    await waitFor(() => {
      expect(onChangeRouteId).toHaveBeenCalledWith('route-2');
    });
  });
});
