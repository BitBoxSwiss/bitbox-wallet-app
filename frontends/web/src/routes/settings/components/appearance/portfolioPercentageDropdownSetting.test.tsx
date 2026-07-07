// SPDX-License-Identifier: Apache-2.0

import type { ContextType, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppContext } from '@/contexts/AppContext';
import { PortfolioPercentageDropdownSetting } from './portfolioPercentageDropdownSetting';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/actionable-item/actionable-item', () => ({
  ActionableItem: ({
    children,
    disabled,
    onClick,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <div
      data-disabled={String(Boolean(disabled))}
      data-has-row-action={String(onClick !== undefined)}
      data-testid="settings-row">
      {children}
    </div>
  ),
}));

describe('PortfolioPercentageDropdownSetting', () => {
  it('keeps the desktop row enabled without wrapping the dropdown in a row action', () => {
    const appContext = {
      portfolioPercentageType: 'moneyWeightedReturn',
      updatePortfolioPercentageType: vi.fn(),
    } as unknown as ContextType<typeof AppContext>;

    render(
      <AppContext.Provider value={appContext}>
        <PortfolioPercentageDropdownSetting />
      </AppContext.Provider>
    );

    const row = screen.getByTestId('settings-row');
    expect(row).toHaveAttribute('data-disabled', 'false');
    expect(row).toHaveAttribute('data-has-row-action', 'false');
    expect(screen.getByRole('combobox')).toBeEnabled();
  });
});
