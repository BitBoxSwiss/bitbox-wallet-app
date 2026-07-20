// SPDX-License-Identifier: Apache-2.0

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

  it('offers coin and fiat units', () => {
    render(<TransactionFilters {...defaultProps} />);
    expect(screen.getByRole('option', { name: 'BTC' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'USD' })).toBeInTheDocument();
  });

  it('propagates changes via onFiltersChange', () => {
    const onFiltersChange = vi.fn();
    render(<TransactionFilters {...defaultProps} onFiltersChange={onFiltersChange} />);
    fireEvent.change(screen.getByLabelText('transactions.filters.type'), { target: { value: 'send' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters, type: 'send' });
    fireEvent.change(screen.getByLabelText('transactions.filters.amountMin'), { target: { value: '10' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters, amountMin: '10' });
  });
});
