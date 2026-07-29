// SPDX-License-Identifier: Apache-2.0

import '../../../../../__mocks__/i18n';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TransactionFilters } from './transaction-filters';
import { emptyFilters } from './use-transaction-filters';

describe('TransactionFilters', () => {
  const defaultProps = {
    filters: emptyFilters,
    onFiltersChange: vi.fn(),
    coinUnit: 'BTC',
    fiatUnit: 'USD',
  };

  it('renders all filter controls', () => {
    render(<TransactionFilters {...defaultProps} />);
    expect(screen.getByLabelText('transactions.filters.from')).toBeInTheDocument();
    expect(screen.getByLabelText('transactions.filters.to')).toBeInTheDocument();
    expect(screen.getByLabelText('transactions.filters.type')).toBeInTheDocument();
    expect(screen.getByLabelText('transactions.filters.amountMin')).toBeInTheDocument();
    expect(screen.getByLabelText('transactions.filters.amountMax')).toBeInTheDocument();
  });

  it('offers coin and fiat units as pill buttons', () => {
    render(<TransactionFilters {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'BTC' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'USD' })).toBeInTheDocument();
    // the fiat default is marked as the pressed pill
    expect(screen.getByRole('button', { name: 'USD' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'BTC' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('propagates changes via onFiltersChange', () => {
    const onFiltersChange = vi.fn();
    render(<TransactionFilters {...defaultProps} onFiltersChange={onFiltersChange} />);
    fireEvent.change(screen.getByLabelText('transactions.filters.type'), { target: { value: 'send' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters, type: 'send' });
    fireEvent.change(screen.getByLabelText('transactions.filters.amountMin'), { target: { value: '10' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters, amountMin: '10' });
  });

  it('gives the unit pill group an accessible name', () => {
    render(<TransactionFilters {...defaultProps} />);
    expect(screen.getByRole('group', { name: 'transactions.filters.unit' })).toBeInTheDocument();
  });

  it('propagates date, max amount and unit changes', () => {
    const onFiltersChange = vi.fn();
    render(<TransactionFilters {...defaultProps} onFiltersChange={onFiltersChange} />);
    fireEvent.change(screen.getByLabelText('transactions.filters.from'), { target: { value: '2026-07-01' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters, fromDate: '2026-07-01' });
    fireEvent.change(screen.getByLabelText('transactions.filters.to'), { target: { value: '2026-07-31' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters, toDate: '2026-07-31' });
    fireEvent.change(screen.getByLabelText('transactions.filters.amountMax'), { target: { value: '25' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters, amountMax: '25' });
    // 'coin' differs from the 'fiat' default, so this assertion still
    // discriminates a broken handler from a working one.
    fireEvent.click(screen.getByRole('button', { name: 'BTC' }));
    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters, amountUnit: 'coin' });
  });
});
