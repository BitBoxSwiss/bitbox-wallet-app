// SPDX-License-Identifier: Apache-2.0

import type { ContextType } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AppContext } from '@/contexts/AppContext';
import { LocalizationContext } from '@/contexts/localization-context';
import { PercentageDiff } from './percentage-diff';

const appContext = {
  hideAmounts: false,
  nativeLocale: 'en',
} as ContextType<typeof AppContext>;

const renderPercentageDiff = (difference: number | null, onClick = vi.fn()) => {
  render(
    <AppContext.Provider value={appContext}>
      <LocalizationContext.Provider value={{ decimal: '.', group: ',' }}>
        <PercentageDiff
          ariaLabel="Switch percentage display"
          difference={difference}
          onClick={onClick}
        />
      </LocalizationContext.Provider>
    </AppContext.Provider>
  );
  return onClick;
};

describe('PercentageDiff', () => {
  it('renders zero as a valid percentage and keeps the toggle usable', () => {
    const onClick = renderPercentageDiff(0);

    const toggle = screen.getByRole('button', { name: 'Switch percentage display' });
    expect(toggle).toHaveTextContent('0.00%');
    fireEvent.click(toggle);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders an accessible placeholder when performance is unavailable', () => {
    renderPercentageDiff(null);

    expect(screen.getByRole('button', { name: 'Switch percentage display' })).toHaveTextContent('—');
  });
});
