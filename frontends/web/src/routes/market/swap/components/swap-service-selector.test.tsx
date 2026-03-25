// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SwapServiceSelector } from './swap-service-selector';

describe('routes/market/swap/components/swap-service-selector', () => {
  it('shows an empty selector when the route selection is cleared', () => {
    render(
      <SwapServiceSelector
        buyUnit="ETH"
        isLoading={false}
        onChangeRouteId={vi.fn()}
        routes={[]}
      />,
    );

    expect(screen.queryByText('generic.select')).not.toBeInTheDocument();
  });

  it('keeps the selector enabled when there is a single route but none selected', () => {
    render(
      <SwapServiceSelector
        buyUnit="ETH"
        isLoading={false}
        onChangeRouteId={vi.fn()}
        routes={[
          { routeId: 'route-1', expectedBuyAmount: '1.23' },
        ]}
      />,
    );

    expect(screen.getByRole('combobox')).toBeEnabled();
  });
});
